export function getAuthErrorMessage(
  error: unknown,
  context: 'signIn' | 'signUp',
): string {
  if (!(error instanceof Error) || error.message.trim().length === 0) {
    return context === 'signUp'
      ? 'Couldn’t create account. Try again.'
      : 'Couldn’t sign in. Try again.';
  }

  const message = error.message.toLowerCase();

  if (message.includes('network') || message.includes('fetch')) {
    return context === 'signUp'
      ? 'Couldn’t create account. Check your connection and try again.'
      : 'Couldn’t sign in. Check your connection and try again.';
  }

  if (
    message.includes('invalid login') ||
    message.includes('invalid credentials') ||
    message.includes('invalid email or password')
  ) {
    return 'Email or password is incorrect.';
  }

  if (message.includes('email not confirmed')) {
    return 'Confirm your email before signing in.';
  }

  if (message.includes('already registered') || message.includes('user already exists')) {
    return 'An account with this email already exists. Go to login.';
  }

  return error.message;
}
