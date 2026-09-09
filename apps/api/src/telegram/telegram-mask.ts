export function maskTelegramUsername(username: string | null | undefined): string | null {
  const trimmed = username?.trim().replace(/^@/, '') ?? '';
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length <= 2) {
    return `@${trimmed[0] ?? '*'}*`;
  }

  const start = trimmed.slice(0, 2);
  const end = trimmed.slice(-1);
  return `@${start}***${end}`;
}

export function maskTelegramUserId(userId: string | null | undefined): string | null {
  const trimmed = userId?.trim() ?? '';
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.length <= 4) {
    return `${trimmed[0] ?? '*'}***`;
  }

  return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
}

export function maskedTelegramDisplay(input: {
  username?: string | null;
  telegramUserId?: string | null;
}): string | null {
  return (
    maskTelegramUsername(input.username) ??
    maskTelegramUserId(input.telegramUserId)
  );
}
