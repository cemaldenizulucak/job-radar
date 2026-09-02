import Constants from 'expo-constants';
import { Platform } from 'react-native';

import {
  JOB_DISCOVERY_PUSH_TYPE,
  isJobDiscoveryNotification,
  jobDiscoveryNotificationRoute,
} from './push-notification-data';

export {
  JOB_DISCOVERY_PUSH_TYPE,
  isJobDiscoveryNotification,
  jobDiscoveryNotificationRoute,
};

export type PushRegistrationStatus =
  | 'granted'
  | 'denied'
  | 'unsupported'
  | 'error';

export type PushRegistrationResult = {
  token: string | null;
  status: PushRegistrationStatus;
};

export async function configureForegroundNotificationHandler(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') {
    return { token: null, status: 'unsupported' };
  }

  try {
    const Device = await import('expo-device');
    if (!Device.isDevice) {
      return { token: null, status: 'unsupported' };
    }

    const Notifications = await import('expo-notifications');

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Job alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#208AEF',
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }

    if (status !== 'granted') {
      return { token: null, status: 'denied' };
    }

    const projectId = readExpoProjectId();
    const tokenResponse = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    const token = tokenResponse.data.trim();

    if (!token) {
      return { token: null, status: 'error' };
    }

    return { token, status: 'granted' };
  } catch {
    return { token: null, status: 'error' };
  }
}

function readExpoProjectId(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_PROJECT_ID?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const extra = Constants.expoConfig?.extra;
  const fromExtra =
    extra && isRecord(extra) && isRecord(extra.eas) && typeof extra.eas.projectId === 'string'
      ? extra.eas.projectId.trim()
      : '';
  return fromExtra.length > 0 ? fromExtra : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
