export type TelegramStatus = {
  connected: boolean;
  displayName: string | null;
  connectedAt: string | null;
  botUsername: string | null;
};

export type TelegramLinkCode = {
  code: string;
  expiresAt: string;
  botUsername: string | null;
};
