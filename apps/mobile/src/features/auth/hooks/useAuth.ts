import { useAuthStore } from '../stores/auth.store';

export function useAuth() {
  const session = useAuthStore((state) => state.session);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const initialize = useAuthStore((state) => state.initialize);
  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);
  const signOut = useAuthStore((state) => state.signOut);

  return {
    session,
    user,
    isAuthenticated,
    isLoading,
    initialize,
    signIn,
    signUp,
    signOut,
  };
}
