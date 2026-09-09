export type TelegramConnectionRow = {
  id: string;
  userId: string;
  telegramChatId: string;
  telegramUserId: string | null;
  telegramUsername: string | null;
  connectedAt: string;
};

export type TelegramLinkCodeResponse = {
  code: string;
  expiresAt: string;
  botUsername: string | null;
};

export type TelegramStatusResponse = {
  connected: boolean;
  displayName: string | null;
  connectedAt: string | null;
  botUsername: string | null;
};

export type TelegramLinkResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'invalid_or_expired' | 'chat_linked_to_other_user' };
