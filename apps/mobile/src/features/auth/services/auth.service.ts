import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

import type {
  AuthChangeUnsubscribe,
  AuthSession,
  AuthUser,
  SignInCredentials,
  SignUpCredentials,
} from '../types/auth.types';

export class AuthServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

function readUserName(user: User): string | null {
  const metadata = user.user_metadata;
  const value = metadata['display_name'] ?? metadata['name'];

  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function mapUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
    name: readUserName(user),
  };
}

function mapSession(session: Session | null): AuthSession | null {
  if (!session) {
    return null;
  }

  return {
    accessToken: session.access_token,
    expiresAt: session.expires_at ?? null,
    user: mapUser(session.user),
  };
}

function throwIfError(error: { message: string } | null): void {
  if (error) {
    throw new AuthServiceError(error.message);
  }
}

export async function signUp(
  credentials: SignUpCredentials,
): Promise<{ session: AuthSession | null; user: AuthUser | null }> {
  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      data: {
        display_name: credentials.name,
        name: credentials.name,
      },
    },
  });

  throwIfError(error);

  return {
    session: mapSession(data.session),
    user: data.user ? mapUser(data.user) : null,
  };
}

export async function signIn(credentials: SignInCredentials): Promise<AuthSession> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  throwIfError(error);

  const session = mapSession(data.session);

  if (!session) {
    throw new AuthServiceError('Giriş başarılı ancak oturum oluşturulamadı.');
  }

  return session;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  throwIfError(error);
}

export async function getSession(): Promise<AuthSession | null> {
  const { data, error } = await supabase.auth.getSession();
  throwIfError(error);
  return mapSession(data.session);
}

export function subscribeToAuthChanges(
  onChange: (session: AuthSession | null) => void,
): AuthChangeUnsubscribe {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    onChange(mapSession(session));
  });

  return () => {
    data.subscription.unsubscribe();
  };
}
