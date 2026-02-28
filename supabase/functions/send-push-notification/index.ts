import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Edge Function : envoie une notification push Web à un utilisateur
 * via le protocole Web Push + VAPID + chiffrement RFC 8291 (aes128gcm).
 *
 * Body JSON attendu :
 *   { user_id: string, titre: string, message: string, url?: string }
 */

interface PushPayload {
  user_id: string;
  titre: string;
  message: string;
  url?: string;
}

interface PushSubscriptionRow {
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
}

// ─── Utilitaires base64 ─────────────────────────────────────

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ─── Utilitaires VAPID ──────────────────────────────────────

/**
 * Importe la clé privée VAPID (base64url, 32 octets bruts) en format JWK.
 * Le format JWK est le plus fiable cross-runtime (Deno, Node, browsers).
 * On a besoin de la clé publique pour construire le JWK complet (x, y).
 */
async function importVapidKeys(
  privateKeyB64url: string,
  publicKeyB64url: string,
): Promise<CryptoKey> {
  // La clé publique est un point P-256 non compressé (65 octets : 0x04 + x[32] + y[32])
  const pubRaw = base64urlToUint8Array(publicKeyB64url);
  const x = uint8ArrayToBase64url(pubRaw.subarray(1, 33));
  const y = uint8ArrayToBase64url(pubRaw.subarray(33, 65));
  const d = privateKeyB64url; // déjà en base64url

  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x,
    y,
    d,
    ext: true,
  };

  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

async function buildVapidJwt(
  audience: string,
  subject: string,
  privateKey: CryptoKey,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };

  const encodedHeader = uint8ArrayToBase64url(
    new TextEncoder().encode(JSON.stringify(header)),
  );
  const encodedPayload = uint8ArrayToBase64url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${uint8ArrayToBase64url(new Uint8Array(signature))}`;
}

// ─── Chiffrement payload (RFC 8291 / aes128gcm) ─────────────

/** HMAC-SHA-256 */
async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data));
}

/** HKDF-Expand, premier bloc uniquement (suffisant pour ≤ 32 octets) */
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  return (await hmacSha256(prk, new Uint8Array([...info, 0x01]))).subarray(0, length);
}

/**
 * Chiffre le payload JSON en aes128gcm selon RFC 8291.
 * Retourne le corps binaire à envoyer avec Content-Encoding: aes128gcm.
 */
async function buildEncryptedBody(
  plaintext: string,
  p256dhB64: string,
  authB64: string,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const receiverPub = base64urlToUint8Array(p256dhB64);
  const authSecret = base64urlToUint8Array(authB64);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Paire de clés éphémère expéditeur
  const senderPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
  );
  const senderPub = new Uint8Array(
    await crypto.subtle.exportKey('raw', senderPair.publicKey),
  );

  // Import de la clé publique du destinataire
  const receiverKey = await crypto.subtle.importKey(
    'raw', receiverPub, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  );

  // Secret partagé ECDH (32 octets)
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: receiverKey }, senderPair.privateKey, 256,
    ),
  );

  // IKM = HKDF(salt=auth, ikm=ecdh, info="WebPush: info\0"+receiverPub+senderPub, L=32)
  const prkAuth = await hmacSha256(authSecret, ecdhSecret);
  const ikmInfo = new Uint8Array([
    ...enc.encode('WebPush: info\x00'), ...receiverPub, ...senderPub,
  ]);
  const ikm = await hkdfExpand(prkAuth, ikmInfo, 32);

  // PRK = HKDF-Extract(salt_aléatoire, IKM)
  const prk = await hmacSha256(salt, ikm);

  // CEK (16 octets) et nonce (12 octets)
  const cek = await hkdfExpand(prk, enc.encode('Content-Encoding: aes128gcm\x00'), 16);
  const nonce = await hkdfExpand(prk, enc.encode('Content-Encoding: nonce\x00'), 12);

  // Chiffrement AES-128-GCM : plaintext + délimiteur 0x02 (enregistrement final)
  const cekKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const padded = new Uint8Array([...enc.encode(plaintext), 0x02]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cekKey, padded),
  );

  // Corps final : salt(16) + rs(4 BE=4096) + idlen(1=65) + senderPub(65) + ciphertext
  const body = new Uint8Array(16 + 4 + 1 + 65 + ciphertext.length);
  let o = 0;
  body.set(salt, o); o += 16;
  body[o++] = 0x00; body[o++] = 0x00; body[o++] = 0x10; body[o++] = 0x00; // 4096 big-endian
  body[o++] = 65; // longueur senderPub (clé P-256 non compressée)
  body.set(senderPub, o); o += 65;
  body.set(ciphertext, o);

  return body;
}

// ─── Envoi Web Push ──────────────────────────────────────────

async function sendWebPush(
  subscription: PushSubscriptionRow,
  bodyJson: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
): Promise<number> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.hostname}`;

  const privateKey = await importVapidKeys(vapidPrivateKey, vapidPublicKey);

  const jwt = await buildVapidJwt(audience, vapidSubject, privateKey);
  const vapidAuth = `vapid t=${jwt},k=${vapidPublicKey}`;

  // Chiffrement RFC 8291
  const encryptedBody = await buildEncryptedBody(
    bodyJson, subscription.p256dh_key, subscription.auth_key,
  );

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: vapidAuth,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
    },
    body: encryptedBody,
  });

  return response.status;
}

// ─── CORS ────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Handler principal ───────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  const vapidPublicKey = Deno.env.get('VITE_VAPID_PUBLIC_KEY') ?? '';
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@locaboard.fr';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let body: PushPayload;
  try {
    body = await req.json() as PushPayload;
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
  }

  if (!body.user_id || !body.titre || !body.message) {
    return new Response('Missing fields', { status: 400, headers: corsHeaders });
  }

  // Debug: vérifier les variables d'environnement
  if (!vapidPublicKey || !vapidPrivateKey) {
    return new Response(JSON.stringify({
      sent: 0,
      error: 'VAPID keys missing',
      has_public: !!vapidPublicKey,
      has_private: !!vapidPrivateKey,
      private_len: vapidPrivateKey.length,
      public_len: vapidPublicKey.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Récupérer toutes les subscriptions de l'utilisateur
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh_key, auth_key')
    .eq('user_id', body.user_id);

  if (error || !subscriptions || subscriptions.length === 0) {
    return new Response(JSON.stringify({
      sent: 0,
      debug: {
        user_id: body.user_id,
        error: error?.message ?? null,
        subscriptions_count: subscriptions?.length ?? 0,
        has_service_role: !!serviceRoleKey,
        has_supabase_url: !!supabaseUrl,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const pushBody = JSON.stringify({
    titre: body.titre,
    message: body.message,
    url: body.url ?? '/LocaBoard/',
  });

  let sent = 0;
  const expiredEndpoints: string[] = [];
  const errors: string[] = [];

  await Promise.allSettled(
    (subscriptions as PushSubscriptionRow[]).map(async (sub) => {
      try {
        const status = await sendWebPush(sub, pushBody, vapidPublicKey, vapidPrivateKey, vapidSubject);
        if (status === 410 || status === 404) {
          expiredEndpoints.push(sub.endpoint);
        } else if (status < 300) {
          sent++;
        } else {
          errors.push(`status=${status} endpoint=${sub.endpoint.substring(0, 60)}`);
        }
      } catch (e) {
        const err = e as Error;
        errors.push(`throw: ${err.message ?? String(e)} | stack: ${(err.stack ?? '').substring(0, 200)}`);
      }
    }),
  );

  // Nettoyer les subscriptions expirées
  if (expiredEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expiredEndpoints);
  }

  return new Response(JSON.stringify({ sent, expired: expiredEndpoints.length, errors, subs: subscriptions.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
