import { useState, useEffect, useCallback } from 'react';
import {
  isPushSupported,
  isPushSubscribed,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/pushNotifications';

type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

interface UsePushNotificationsResult {
  permission: PushPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const supported = isPushSupported();

  const [permission, setPermission] = useState<PushPermission>(
    !supported ? 'unsupported' : (Notification.permission as PushPermission),
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supported) {
      setIsLoading(false);
      return;
    }
    isPushSubscribed().then((subscribed) => {
      setIsSubscribed(subscribed);
      setIsLoading(false);
    });
  }, [supported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await subscribeToPush();
      if (success) {
        setPermission('granted');
        setIsSubscribed(true);
      } else {
        setPermission(Notification.permission as PushPermission);
      }
      return success;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await unsubscribeFromPush();
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { permission, isSubscribed, isLoading, subscribe, unsubscribe };
}
