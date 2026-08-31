import { Injectable } from '@nestjs/common';
import type { Asset } from '../generated/prisma/client.js';
import type { AssetUploadedEvent } from '@nestflux/contracts';
import { randomUUID } from 'node:crypto';

@Injectable()
export class AssetEventService {
  createAssetUploadedEvent(asset: Asset): AssetUploadedEvent {
    return {
      type: 'asset.uploaded',
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      data: {
        assetId: asset.id,
        storageKey: asset.storageKey,
        originalFilename: asset.originalFilename,
        contentType: asset.contentType,
        sizeBytes: asset.sizeBytes,
      },
    };
  }
}
