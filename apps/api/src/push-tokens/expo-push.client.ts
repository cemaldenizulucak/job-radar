import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_BATCH_SIZE = 100;

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: {
    type: string;
    route: string;
  };
};

export type ExpoPushTicket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message: string; errorCode: string | null };

@Injectable()
export class ExpoPushClient {
  private readonly logger = new Logger(ExpoPushClient.name);

  constructor(private readonly configService: ConfigService) {}

  async send(messages: readonly ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    if (messages.length === 0) {
      return [];
    }

    const tickets: ExpoPushTicket[] = [];

    for (let index = 0; index < messages.length; index += EXPO_PUSH_BATCH_SIZE) {
      const batch = messages.slice(index, index + EXPO_PUSH_BATCH_SIZE);
      const batchTickets = await this.sendBatch(batch);
      tickets.push(...batchTickets);
    }

    return tickets;
  }

  private async sendBatch(
    messages: readonly ExpoPushMessage[],
  ): Promise<ExpoPushTicket[]> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    };

    const accessToken = this.configService.get<string>('EXPO_ACCESS_TOKEN')?.trim();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      this.logger.warn({
        message: 'Expo Push API request failed',
        status: response.status,
      });
      return messages.map(() => ({
        status: 'error',
        message: `Expo Push API HTTP ${response.status}`,
        errorCode: null,
      }));
    }

    return parseTickets(payload, messages.length);
  }
}

function parseTickets(payload: unknown, expectedCount: number): ExpoPushTicket[] {
  const data = isRecord(payload) ? payload.data : undefined;
  if (!Array.isArray(data)) {
    return Array.from({ length: expectedCount }, () => ({
      status: 'error',
      message: 'Expo Push API returned an unexpected payload',
      errorCode: null,
    }));
  }

  return data.map((item) => mapTicket(item));
}

function mapTicket(value: unknown): ExpoPushTicket {
  if (!isRecord(value)) {
    return {
      status: 'error',
      message: 'Unreadable Expo push ticket',
      errorCode: null,
    };
  }

  if (value.status === 'ok' && typeof value.id === 'string') {
    return { status: 'ok', id: value.id };
  }

  const details = isRecord(value.details) ? value.details : null;
  const errorCode =
    details && typeof details.error === 'string' ? details.error : null;
  const message =
    typeof value.message === 'string' && value.message.length > 0
      ? value.message
      : 'Expo push ticket error';

  return { status: 'error', message, errorCode };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
