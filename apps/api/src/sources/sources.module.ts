import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { KariyerNetSourceAdapter } from './adapters/kariyer-net-source.adapter.js';
import { LinkedInSourceAdapter } from './adapters/linkedin-source.adapter.js';
import {
  createKariyerNetProviderFromConfig,
} from './kariyer-net/kariyer-net-provider.factory.js';
import { KARIYER_NET_PROVIDER } from './kariyer-net/kariyer-net.tokens.js';
import {
  createLinkedInProviderFromConfig,
} from './linkedin/linkedin-provider.factory.js';
import { LINKEDIN_PROVIDER } from './linkedin/linkedin.tokens.js';
import { SourceRegistry } from './source-registry.js';
import { JOB_SOURCE_ADAPTERS } from './source.tokens.js';

@Module({
  providers: [
    {
      provide: LINKEDIN_PROVIDER,
      useFactory: (config: ConfigService) =>
        createLinkedInProviderFromConfig(config),
      inject: [ConfigService],
    },
    LinkedInSourceAdapter,
    {
      provide: KARIYER_NET_PROVIDER,
      useFactory: (config: ConfigService) =>
        createKariyerNetProviderFromConfig(config),
      inject: [ConfigService],
    },
    KariyerNetSourceAdapter,
    {
      provide: JOB_SOURCE_ADAPTERS,
      useFactory: (
        linkedIn: LinkedInSourceAdapter,
        kariyerNet: KariyerNetSourceAdapter,
      ) => [linkedIn, kariyerNet],
      inject: [LinkedInSourceAdapter, KariyerNetSourceAdapter],
    },
    SourceRegistry,
  ],
  exports: [SourceRegistry],
})
export class SourcesModule {}
