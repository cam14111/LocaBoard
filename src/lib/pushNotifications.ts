import { supabase } from '@/lib/supabase';

/** Vérifie si le navigateur supporte les push notifications */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Convertit une clé VAPID base64url en Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as Uint8Array<ArrayBuffer>;
}

/** Sauvegarde un abonnement push en base de données */
async function savePushSubscription(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh_key: json.keys?.['p256dh'] ?? '',
      auth_key: json.keys?.['auth'] ?? '',
      user_agent: navigator.userAgent.substring(0, 200),
    },
    { onConflict: 'endpoint' },
  );
  if (error) throw error;
}

/** Supprime un abonnement push de la base de données */
async function deletePushSubscription(endpoint: string): Promise<void> {
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

/**
 * Demande la permission, souscrit au service push et enregistre l'endpoint.
 * Retourne true si l'abonnement a réussi.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const sw = await navigator.serviceWorker.ready;
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidPublicKey) return false;

  const subscription = await sw.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  await savePushSubscription(subscription);
  return true;
}

/** Se désabonne et supprime l'endpoint de la base de données */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;

  const sw = await navigator.serviceWorker.ready;
  const subscription = await sw.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await deletePushSubscription(endpoint);
}

/** Vérifie si l'utilisateur est actuellement abonné aux push */
export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const sw = await navigator.serviceWorker.ready;
    const subscription = await sw.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}
