import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { DuplicatesModule } from './duplicates/duplicates.module.js';
import { DiscoveryModule } from './discovery/discovery.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { LocationsModule } from './locations/locations.module.js';
import { MailIngestionModule } from './mail-ingestion/mail-ingestion.module.js';
import { MatchingModule } from './matching/matching.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PushTokensModule } from './push-tokens/push-tokens.module.js';
import { FavoritesModule } from './favorites/favorites.module.js';
import { ApplicationsModule } from './applications/applications.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { SchedulerModule } from './scheduler/scheduler.module.js';
import { SearchesModule } from './searches/searches.module.js';
import { SourcesModule } from './sources/sources.module.js';
import { TelegramModule } from './telegram/telegram.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
    JobsModule,
    LocationsModule,
    SearchesModule,
    SourcesModule,
    MatchingModule,
    DuplicatesModule,
    DiscoveryModule,
    NotificationsModule,
    TelegramModule,
    PushTokensModule,
    FavoritesModule,
    ApplicationsModule,
    ProfilesModule,
    MailIngestionModule,
    SchedulerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}