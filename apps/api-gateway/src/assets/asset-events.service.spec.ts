import { AssetStatus, type Asset } from '../generated/prisma/client.js';
import { AssetEventService } from './asset-events.service.js';

describe('AssetEventService', () => {
  const service = new AssetEventService();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-31T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates an asset.uploaded event from an asset record', () => {
    const asset: Asset = {
      id: 'asset_123',
      originalFilename: 'sunset.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      storageKey: 'assets/storage-key',
      status: AssetStatus.PENDING,
      createdAt: new Date('2026-08-31T00:00:00.000Z'),
      updatedAt: new Date('2026-08-31T00:00:00.000Z'),
    };

    expect(service.createAssetUploadedEvent(asset)).toEqual({
      type: 'asset.uploaded',
      eventId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
      occurredAt: '2026-08-31T00:00:00.000Z',
      data: {
        assetId: 'asset_123',
        storageKey: 'assets/storage-key',
        originalFilename: 'sunset.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
      },
    });
  });
});
