import { authCopy } from '../copy';

export function getAuthErrorMessage(
  error: unknown,
  context: 'signIn' | 'signUp',
): string {
  if (!(error instanceof Error) || error.message.trim().length === 0) {
    return context === 'signUp' ? authCopy.signUpFailed : authCopy.signInFailed;
  }

  const message = error.message.toLowerCase();

  if (message.includes('network') || message.includes('fetch')) {
    return context === 'signUp' ? authCopy.signUpNetwork : authCopy.signInNetwork;
  }

  if (
    message.includes('invalid login') ||
    message.includes('invalid credentials') ||
    message.includes('invalid email or password')
  ) {
    return authCopy.invalidCredentials;
  }

  if (message.includes('email not confirmed')) {
    return authCopy.emailNotConfirmed;
  }

  if (message.includes('already registered') || message.includes('user already exists')) {
    return authCopy.alreadyRegistered;
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return error.message;
  }

  return context === 'signUp' ? authCopy.signUpFailed : authCopy.signInFailed;
}
