export type SignInCredentials = {
  email: string;
  password: string;
};

export type SignUpCredentials = {
  name: string;
  email: string;
  password: string;
};

export type AuthUser = {
  id: string;
  email: string | null;
  name: string | null;
};

export type AuthSession = {
  accessToken: string;
  expiresAt: number | null;
  user: AuthUser;
};

export type AuthChangeUnsubscribe = () => void;
