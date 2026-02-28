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

async function importVapidPrivateKey(privateKeyB64url: string): Promise<CryptoKey> {
  const raw = base64urlToUint8Array(privateKeyB64url);
  return crypto.subtle.importKey(
    'pkcs8',
    buildPkcs8(raw),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

function buildPkcs8(rawKey: Uint8Array): ArrayBuffer {
  const header = new Uint8Array([
    0x30, 0x41,
    0x02, 0x01, 0x00,
    0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
    0x04, 0x27,
    0x30, 0x25,
    0x02, 0x01, 0x01,
    0x04, 0x20,
  ]);
  const buf = new Uint8Array(header.length + rawKey.length);
  buf.set(header);
  buf.set(rawKey, header.length);
  return buf.buffer;
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

  let privateKey: CryptoKey;
  try {
    privateKey = await importVapidPrivateKey(vapidPrivateKey);
  } catch {
    const raw = base64urlToUint8Array(vapidPrivateKey);
    privateKey = await crypto.subtle.importKey(
      'raw', raw, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
    );
  }

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

// ─── Handler principal ───────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
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
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!body.user_id || !body.titre || !body.message) {
    return new Response('Missing fields', { status: 400 });
  }

  // Récupérer toutes les subscriptions de l'utilisateur
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh_key, auth_key')
    .eq('user_id', body.user_id);

  if (error || !subscriptions || subscriptions.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const pushBody = JSON.stringify({
    titre: body.titre,
    message: body.message,
    url: body.url ?? '/LocaBoard/',
  });

  let sent = 0;
  const expiredEndpoints: string[] = [];

  await Promise.allSettled(
    (subscriptions as PushSubscriptionRow[]).map(async (sub) => {
      try {
        const status = await sendWebPush(sub, pushBody, vapidPublicKey, vapidPrivateKey, vapidSubject);
        if (status === 410 || status === 404) {
          expiredEndpoints.push(sub.endpoint);
        } else if (status < 300) {
          sent++;
        }
      } catch {
        // Ignore les erreurs individuelles
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

  return new Response(JSON.stringify({ sent, expired: expiredEndpoints.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
