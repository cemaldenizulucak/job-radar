export const TELEGRAM_HTTP_POST = 'TELEGRAM_HTTP_POST';

export type TelegramHttpPost = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

export const TELEGRAM_REQUEST_TIMEOUT_MS = 10_000;

export function defaultTelegramHttpPost(
  url: string,
  init: RequestInit,
): Promise<Response> {
  return fetch(url, init);
}

export function telegramSendMessageUrl(token: string): string {
  return `https://api.telegram.org/bot${token}/sendMessage`;
}

export function telegramSetWebhookUrl(token: string): string {
  return `https://api.telegram.org/bot${token}/setWebhook`;
}
