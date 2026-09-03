import { Module } from '@nestjs/common';

import { LocationsModule } from '../locations/locations.module.js';
import { MatchingService } from './matching.service.js';

@Module({
  imports: [LocationsModule],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}

