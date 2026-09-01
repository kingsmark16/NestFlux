import type { AssetUploadedEvent } from '@nestflux/contracts';
import { Test, type TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { AssetEventsPublisher } from './asset-event.publisher.js';
import { ASSET_EVENTS_CLIENT } from './messaging.tokens.js';

describe('AssetEventsPublisher', () => {
  const event: AssetUploadedEvent = {
    type: 'asset.uploaded',
    eventId: '0ef954b7-80b3-4fa0-a104-8fd7bd9a1fc1',
    occurredAt: '2026-09-01T00:00:00.000Z',
    data: {
      assetId: 'asset-1',
      storageKey: 'assets/asset-1',
      originalFilename: 'sunset.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
    },
  };

  const client = {
    connect: vi.fn(),
    emit: vi.fn(),
  };

  let moduleRef: TestingModule;
  let publisher: AssetEventsPublisher;

  beforeEach(async () => {
    vi.clearAllMocks();

    moduleRef = await Test.createTestingModule({
      providers: [
        AssetEventsPublisher,
        {
          provide: ASSET_EVENTS_CLIENT,
          useValue: client,
        },
      ],
    }).compile();

    publisher = moduleRef.get(AssetEventsPublisher);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('connects to RabbitMQ during application bootstrap', async () => {
    client.connect.mockResolvedValue(undefined);

    await publisher.onApplicationBootstrap();

    expect(client.connect).toHaveBeenCalledOnce();
  });

  it('publishes the complete event with its event type as the pattern', async () => {
    client.emit.mockReturnValue(of(undefined));

    await publisher.publishAssetUploaded(event);

    expect(client.emit).toHaveBeenCalledWith('asset.uploaded', event);
  });

  it('propagates a RabbitMQ publishing error', async () => {
    const error = new Error('RabbitMQ unavailable');
    client.emit.mockReturnValue(throwError(() => error));

    await expect(publisher.publishAssetUploaded(event)).rejects.toBe(error);
  });
});
