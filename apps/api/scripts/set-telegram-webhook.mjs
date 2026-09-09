#!/usr/bin/env node
/**
 * Register (or clear) the JobRadar Telegram webhook.
 * Do not run this from API startup.
 *
 * Required env:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_WEBHOOK_SECRET
 *   TELEGRAM_WEBHOOK_URL   e.g. https://api.example.com/v1/telegram/webhook
 *
 * Optional:
 *   TELEGRAM_WEBHOOK_CLEAR=true   delete the webhook instead of setting it
 *
 * Usage:
 *   npm run telegram:set-webhook
 */
const token = readEnv('TELEGRAM_BOT_TOKEN');
const secret = readEnv('TELEGRAM_WEBHOOK_SECRET');
const webhookUrl = readEnv('TELEGRAM_WEBHOOK_URL');
const clear = process.env.TELEGRAM_WEBHOOK_CLEAR === 'true';

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is required.');
  process.exit(1);
}

if (!clear && !secret) {
  console.error('TELEGRAM_WEBHOOK_SECRET is required.');
  process.exit(1);
}

if (!clear && !webhookUrl) {
  console.error('TELEGRAM_WEBHOOK_URL is required.');
  process.exit(1);
}

const endpoint = `https://api.telegram.org/bot${token}/setWebhook`;
const body = clear
  ? { url: '' }
  : {
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message'],
      drop_pending_updates: false,
    };

const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const payload = await response.json().catch(() => null);
const ok =
  response.ok &&
  payload !== null &&
  typeof payload === 'object' &&
  payload.ok === true;

if (!ok) {
  console.error('Telegram setWebhook failed.');
  process.exit(1);
}

console.log(clear ? 'Telegram webhook cleared.' : 'Telegram webhook registered.');

function readEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
