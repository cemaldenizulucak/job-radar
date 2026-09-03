export const IOS_PUSH_PERMISSIONS = {
  allowAlert: true,
  allowBadge: true,
  allowSound: true,
} as const;

export function nativePushPlatform(os: string): 'ios' | 'android' {
  return os === 'ios' ? 'ios' : 'android';
}

export function shouldRegisterPushOnPlatform(os: string): boolean {
  return os === 'ios' || os === 'android';
}
