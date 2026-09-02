export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

export type AuthenticatedRequest = {
  user?: AuthenticatedUser;
  headers: {
    authorization?: string | string[];
  };
};
