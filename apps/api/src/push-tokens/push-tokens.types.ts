export type PushTokenPlatform = 'ios' | 'android' | 'web';

export type UserPushToken = {
  id: string;
  userId: string;
  expoPushToken: string;
  platform: string | null;
  isActive: boolean;
};

export type RegisterPushTokenInput = {
  userId: string;
  expoPushToken: string;
  platform?: string;
};

export type UnregisterPushTokenInput = {
  userId: string;
  expoPushToken: string;
};

export const JOB_DISCOVERY_PUSH_TYPE = 'JOB_DISCOVERY';
export const JOB_DISCOVERY_PUSH_ROUTE = '/jobs';
