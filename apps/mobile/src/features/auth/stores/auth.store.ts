import { create } from 'zustand';

import { unregisterRememberedPushToken } from '@/features/notifications/services/push-token.session';

import {
  getSession,
  signIn as signInWithSupabase,
  signOut as signOutWithSupabase,
  signUp as signUpWithSupabase,
  subscribeToAuthChanges,
} from '../services/auth.service';
import type {
  AuthSession,
  AuthUser,
  SignInCredentials,
  SignUpCredentials,
} from '../types/auth.types';

type AuthState = {
  session: AuthSession | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
};

type AuthActions = {
  initialize: () => Promise<void>;
  setAuth: (session: AuthSession | null, user?: AuthUser | null) => void;
  signIn: (credentials: SignInCredentials) => Promise<void>;
  signUp: (credentials: SignUpCredentials) => Promise<void>;
  signOut: () => Promise<void>;
};

export type AuthStore = AuthState & AuthActions;

let initializePromise: Promise<void> | null = null;
let unsubscribeFromAuthChanges: (() => void) | null = null;

function applySession(
  session: AuthSession | null,
  user: AuthUser | null = session?.user ?? null,
): Pick<AuthState, 'session' | 'user' | 'isAuthenticated'> {
  return {
    session,
    user,
    isAuthenticated: session !== null,
  };
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (session, user) => {
    set(applySession(session, user));
  },

  initialize: () => {
    if (initializePromise) {
      return initializePromise;
    }

    initializePromise = (async () => {
      set({ isLoading: true });

      try {
        const session = await getSession();
        set({ ...applySession(session), isLoading: false });

        if (!unsubscribeFromAuthChanges) {
          unsubscribeFromAuthChanges = subscribeToAuthChanges((nextSession) => {
            set(applySession(nextSession));
          });
        }
      } catch (error) {
        initializePromise = null;
        set({ ...applySession(null), isLoading: false });
        throw error;
      }
    })();

    return initializePromise;
  },

  signIn: async (credentials) => {
    const session = await signInWithSupabase(credentials);
    set(applySession(session));
  },

  signUp: async (credentials) => {
    const { session, user } = await signUpWithSupabase(credentials);
    set(applySession(session, user));
  },

  signOut: async () => {
    await unregisterRememberedPushToken();
    await signOutWithSupabase();
    set(applySession(null));
  },
}));
