const TELEGRAM_BOT_URL_PATTERN = /https?:\/\/api\.telegram\.org\/bot[^\s"'\\]+/gi;
const TELEGRAM_BOT_TOKEN_PATTERN = /bot\d+:[A-Za-z0-9_-]+/g;

export function redactTelegramSecrets(
  value: string,
  token?: string | null,
  chatId?: string | null,
  extras: readonly (string | null | undefined)[] = [],
): string {
  let redacted = value.replace(TELEGRAM_BOT_URL_PATTERN, 'telegram-api');
  redacted = redacted.replace(TELEGRAM_BOT_TOKEN_PATTERN, 'bot[redacted]');

  const secrets = [token, chatId, ...extras].filter(
    (secret): secret is string => typeof secret === 'string' && secret.length > 0,
  );

  for (const secret of secrets) {
    redacted = redacted.split(secret).join('[redacted]');
  }

  return redacted;
}

export function safeErrorMessage(
  error: unknown,
  token?: string | null,
  chatId?: string | null,
  extras: readonly (string | null | undefined)[] = [],
): string {
  const raw =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : 'unknown';
  return redactTelegramSecrets(raw, token, chatId, extras);
}
