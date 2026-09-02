import { Injectable, Logger } from '@nestjs/common';

import { ExpoPushClient, type ExpoPushMessage } from './expo-push.client.js';
import { PushTokensService } from './push-tokens.service.js';
import {
  JOB_DISCOVERY_PUSH_ROUTE,
  JOB_DISCOVERY_PUSH_TYPE,
} from './push-tokens.types.js';

export type DiscoveryPushPayload = {
  userId: string;
  title: string;
  body: string;
};

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    private readonly pushTokens: PushTokensService,
    private readonly expoPush: ExpoPushClient,
  ) {}

  async sendDiscoveryPush(input: DiscoveryPushPayload): Promise<void> {
    try {
      const tokens = await this.pushTokens.listActiveForUser(input.userId);
      if (tokens.length === 0) {
        return;
      }

      const messages: ExpoPushMessage[] = tokens.map((token) => ({
        to: token.expoPushToken,
        title: input.title,
        body: input.body,
        sound: 'default',
        data: {
          type: JOB_DISCOVERY_PUSH_TYPE,
          route: JOB_DISCOVERY_PUSH_ROUTE,
        },
      }));

      const tickets = await this.expoPush.send(messages);

      let sent = 0;
      let failed = 0;

      for (let index = 0; index < tickets.length; index += 1) {
        const ticket = tickets[index];
        const token = tokens[index];
        if (!ticket || !token) {
          continue;
        }

        if (ticket.status === 'ok') {
          sent += 1;
          continue;
        }

        failed += 1;
        this.logger.warn({
          message: 'Expo push ticket failed',
          userId: input.userId,
          errorCode: ticket.errorCode,
        });

        if (ticket.errorCode === 'DeviceNotRegistered') {
          await this.pushTokens.deactivate(token.expoPushToken);
        }
      }

      this.logger.log({
        message: 'Sent discovery push notifications',
        userId: input.userId,
        tokenCount: tokens.length,
        sent,
        failed,
      });
    } catch (error) {
      this.logger.warn({
        message: 'Push notification send failed; discovery continues',
        userId: input.userId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}
