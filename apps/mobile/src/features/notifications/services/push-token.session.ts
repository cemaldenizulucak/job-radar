import { unregisterPushToken } from './push-token.service';

type RegisteredPushSession = {
  expoPushToken: string;
};

let registered: RegisteredPushSession | null = null;

export function rememberRegisteredPushToken(session: RegisteredPushSession): void {
  registered = session;
}

export async function unregisterRememberedPushToken(): Promise<void> {
  const session = registered;
  registered = null;
  if (!session) {
    return;
  }

  try {
    await unregisterPushToken(session);
  } catch {
    // Logout must not fail if the token cannot be removed.
  }
}
