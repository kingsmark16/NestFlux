import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import type { AssetUploadedEvent } from '@nestflux/contracts';
import type { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { ASSET_EVENTS_CLIENT } from './messaging.tokens.js';

@Injectable()
export class AssetEventsPublisher implements OnApplicationBootstrap {
  constructor(
    @Inject(ASSET_EVENTS_CLIENT)
    private readonly client: ClientProxy,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.client.connect();
  }

  async publishAssetUploaded(event: AssetUploadedEvent): Promise<void> {
    await lastValueFrom(
      this.client.emit<void, AssetUploadedEvent>(event.type, event),
    );
  }
}
