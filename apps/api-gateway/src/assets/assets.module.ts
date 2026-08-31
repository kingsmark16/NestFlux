import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller.js';
import { AssetsService } from './assets.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { AssetEventService } from './asset-events.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AssetsController],
  providers: [AssetsService, AssetEventService],
})
export class AssetsModule {}
