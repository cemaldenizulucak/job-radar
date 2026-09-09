import { ConfigService } from '@nestjs/config';

export type TelegramEnvName =
  | 'TELEGRAM_BOT_TOKEN'
  | 'TELEGRAM_CHAT_ID'
  | 'TELEGRAM_WEBHOOK_SECRET'
  | 'TELEGRAM_BOT_USERNAME'
  | 'TELEGRAM_LEGACY_USER_ID';

export function readOptionalTelegramEnv(
  configService: ConfigService,
  name: TelegramEnvName,
): string | null {
  const value = configService.get<string>(name);
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeBotUsername(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().replace(/^@/, '');
  return trimmed.length > 0 ? trimmed : null;
}
