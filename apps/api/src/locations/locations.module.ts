import { Module } from '@nestjs/common';

import { LocationCatalogProvider } from './location-catalog.provider.js';
import { LocationsController } from './locations.controller.js';
import { LocationsService } from './locations.service.js';

@Module({
  controllers: [LocationsController],
  providers: [LocationCatalogProvider, LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
