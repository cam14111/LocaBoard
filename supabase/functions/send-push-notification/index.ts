import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Edge Function : envoie une notification push Web à un utilisateur
 * via le protocole Web Push + VAPID.
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

// ─── Utilitaires VAPID / Web Push ──────────────────────────

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function importVapidPrivateKey(privateKeyB64url: string): Promise<CryptoKey> {
  const raw = base64urlToUint8Array(privateKeyB64url);
  return crypto.subtle.importKey(
    'pkcs8',
    // PKCS8 wrap for P-256 private key
    buildPkcs8(raw),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

function buildPkcs8(rawKey: Uint8Array): ArrayBuffer {
  // PKCS#8 wrapper for P-256 private key (32 bytes)
  // OID for EC + P-256: 1.2.840.10045.2.1 + 1.2.840.10045.3.1.7
  const header = new Uint8Array([
    0x30, 0x41, // SEQUENCE
    0x02, 0x01, 0x00, // INTEGER (version = 0)
    0x30, 0x13, // SEQUENCE (algorithm)
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID ecPublicKey
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID P-256
    0x04, 0x27, // OCTET STRING
    0x30, 0x25, // SEQUENCE
    0x02, 0x01, 0x01, // INTEGER (version = 1)
    0x04, 0x20, // OCTET STRING (32 bytes key)
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
    // Clé VAPID privée au format raw (non PKCS8) - utiliser un workaround
    // En Deno, on peut importer directement raw
    const raw = base64urlToUint8Array(vapidPrivateKey);
    privateKey = await crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
  }

  const jwt = await buildVapidJwt(audience, vapidSubject, privateKey);
  const vapidAuth = `vapid t=${jwt},k=${vapidPublicKey}`;

  // Encoder le body (UTF-8 simple, non chiffré ECDH pour simplifier)
  const body = new TextEncoder().encode(bodyJson);

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: vapidAuth,
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(body.length),
      TTL: '86400',
    },
    body,
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
