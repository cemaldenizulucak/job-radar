import { router, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useJobsFilterStore } from '@/features/jobs/stores/jobs-filter.store';

import {
  configureForegroundNotificationHandler,
  jobDiscoveryNotificationRoute,
  registerForPushNotifications,
} from '../services/push-registration';
import { rememberRegisteredPushToken } from '../services/push-token.session';
import { registerPushToken } from '../services/push-token.service';

export function usePushNotifications(userId: string | undefined): void {
  const handledResponseIds = useRef(new Set<string>());

  useEffect(() => {
    if (!userId || Platform.OS === 'web') {
      return;
    }

    let cancelled = false;
    let responseSubscription: { remove: () => void } | undefined;

    async function syncToken(): Promise<void> {
      await configureForegroundNotificationHandler();
      const result = await registerForPushNotifications();
      if (cancelled || !result.token) {
        return;
      }

      try {
        await registerPushToken({
          expoPushToken: result.token,
          platform: Platform.OS,
        });
        if (!cancelled) {
          rememberRegisteredPushToken({
            expoPushToken: result.token,
          });
        }
      } catch {
        // Registration is best-effort; the in-app inbox still works.
      }
    }

    function openJobsIfDiscovery(responseId: string, data: unknown): void {
      if (handledResponseIds.current.has(responseId)) {
        return;
      }

      const route = jobDiscoveryNotificationRoute(data);
      if (!route) {
        return;
      }

      handledResponseIds.current.add(responseId);
      useJobsFilterStore.getState().bumpFeedRefresh();
      router.navigate(route as Href);
    }

    async function listenForTaps(): Promise<void> {
      const Notifications = await import('expo-notifications');

      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (!cancelled && lastResponse) {
        openJobsIfDiscovery(
          lastResponse.notification.request.identifier,
          lastResponse.notification.request.content.data,
        );
        await Notifications.clearLastNotificationResponseAsync();
      }

      responseSubscription = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          openJobsIfDiscovery(
            response.notification.request.identifier,
            response.notification.request.content.data,
          );
        },
      );
    }

    void syncToken();
    void listenForTaps();

    return () => {
      cancelled = true;
      responseSubscription?.remove();
    };
  }, [userId]);
}
