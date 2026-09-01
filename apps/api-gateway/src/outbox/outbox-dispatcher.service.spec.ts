import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { AssetEventsPublisher } from '../messaging/asset-event.publisher.js';
import { OutboxDispatcher } from './outbox-dispatcher.service.js';
import { OutboxRepository } from './outbox.repository.js';

describe('OutboxDispatcher', () => {
  const now = new Date('2026-09-01T03:00:00.000Z');
  const lockedAt = new Date('2026-09-01T02:59:59.000Z');

  const claimedEvent = {
    id: 'event_123',
    type: 'asset.uploaded',
    payload: {
      type: 'asset.uploaded',
      eventId: 'event_123',
      occurredAt: '2026-09-01T02:59:58.000Z',
      data: {
        assetId: 'asset_123',
        storageKey: 'assets/generated-key',
        originalFilename: 'sunset.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
      },
    },
    status: 'PROCESSING',
    attempts: 1,
    availableAt: new Date('2026-09-01T02:59:00.000Z'),
    lockedAt,
    publishedAt: null,
    lastError: null,
    createdAt: new Date('2026-09-01T02:59:00.000Z'),
    updatedAt: lockedAt,
  };

  const outboxRepository = {
    claimNextAvailable: vi.fn(),
    markPublished: vi.fn(),
    releaseForRetry: vi.fn(),
  };

  const assetEventsPublisher = {
    publishAssetUploaded: vi.fn(),
  };

  let dispatcher: OutboxDispatcher;
  let loggerError: ReturnType<typeof vi.spyOn>;
  let loggerWarn: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    loggerError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    loggerWarn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  beforeEach(async () => {
    outboxRepository.claimNextAvailable.mockReset();
    outboxRepository.markPublished.mockReset();
    outboxRepository.releaseForRetry.mockReset();
    assetEventsPublisher.publishAssetUploaded.mockReset();
    loggerError.mockClear();
    loggerWarn.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxDispatcher,
        {
          provide: OutboxRepository,
          useValue: outboxRepository,
        },
        {
          provide: AssetEventsPublisher,
          useValue: assetEventsPublisher,
        },
      ],
    }).compile();

    dispatcher = module.get(OutboxDispatcher);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('returns zero when no event is available', async () => {
    outboxRepository.claimNextAvailable.mockResolvedValue(null);

    await expect(dispatcher.dispatchBatch(10, now)).resolves.toBe(0);

    expect(assetEventsPublisher.publishAssetUploaded).not.toHaveBeenCalled();
  });

  it('publishes a claimed event and marks it as published', async () => {
    outboxRepository.claimNextAvailable
      .mockResolvedValueOnce(claimedEvent)
      .mockResolvedValueOnce(null);
    assetEventsPublisher.publishAssetUploaded.mockResolvedValue(undefined);
    outboxRepository.markPublished.mockResolvedValue(true);

    await expect(dispatcher.dispatchBatch(10, now)).resolves.toBe(1);

    expect(assetEventsPublisher.publishAssetUploaded).toHaveBeenCalledWith(
      claimedEvent.payload,
    );
    expect(outboxRepository.markPublished).toHaveBeenCalledWith(
      claimedEvent.id,
      lockedAt,
      now,
    );
    expect(outboxRepository.releaseForRetry).not.toHaveBeenCalled();
  });

  it('schedules a retry and redacts broker credentials on failure', async () => {
    const error = new Error(
      'connect ECONNREFUSED amqp://nestflux:secret@localhost:5672',
    );
    outboxRepository.claimNextAvailable
      .mockResolvedValueOnce(claimedEvent)
      .mockResolvedValueOnce(null);
    assetEventsPublisher.publishAssetUploaded.mockRejectedValue(error);
    outboxRepository.releaseForRetry.mockResolvedValue(true);

    await expect(dispatcher.dispatchBatch(10, now)).resolves.toBe(1);

    expect(outboxRepository.releaseForRetry).toHaveBeenCalledWith(
      claimedEvent.id,
      lockedAt,
      new Date('2026-09-01T03:00:01.000Z'),
      'connect ECONNREFUSED amqp://nestflux:[redacted]@localhost:5672',
    );
    expect(outboxRepository.markPublished).not.toHaveBeenCalled();
  });

  it('caps exponential retry delay at 60 seconds', async () => {
    const repeatedlyFailedEvent = {
      ...claimedEvent,
      attempts: 7,
    };
    outboxRepository.claimNextAvailable
      .mockResolvedValueOnce(repeatedlyFailedEvent)
      .mockResolvedValueOnce(null);
    assetEventsPublisher.publishAssetUploaded.mockRejectedValue(
      new Error('RabbitMQ unavailable'),
    );
    outboxRepository.releaseForRetry.mockResolvedValue(true);

    await dispatcher.dispatchBatch(10, now);

    expect(outboxRepository.releaseForRetry).toHaveBeenCalledWith(
      claimedEvent.id,
      lockedAt,
      new Date('2026-09-01T03:01:00.000Z'),
      'RabbitMQ unavailable',
    );
  });

  it('releases an event whose payload identity is invalid', async () => {
    const invalidEvent = {
      ...claimedEvent,
      payload: {
        ...claimedEvent.payload,
        eventId: 'different_event',
      },
    };
    outboxRepository.claimNextAvailable
      .mockResolvedValueOnce(invalidEvent)
      .mockResolvedValueOnce(null);
    outboxRepository.releaseForRetry.mockResolvedValue(true);

    await dispatcher.dispatchBatch(10, now);

    expect(assetEventsPublisher.publishAssetUploaded).not.toHaveBeenCalled();
    expect(outboxRepository.releaseForRetry).toHaveBeenCalledWith(
      invalidEvent.id,
      lockedAt,
      new Date('2026-09-01T03:00:01.000Z'),
      `Invalid payload for outbox event ${invalidEvent.id}`,
    );
  });

  it('rejects a claimed event without a lock timestamp', async () => {
    outboxRepository.claimNextAvailable.mockResolvedValue({
      ...claimedEvent,
      lockedAt: null,
    });

    await expect(dispatcher.dispatchBatch(10, now)).rejects.toThrow(
      `Claimed outbox event ${claimedEvent.id} has no lock`,
    );
  });

  it('limits each batch to 100 claimed events', async () => {
    outboxRepository.claimNextAvailable.mockResolvedValue(claimedEvent);
    assetEventsPublisher.publishAssetUploaded.mockResolvedValue(undefined);
    outboxRepository.markPublished.mockResolvedValue(true);

    await expect(dispatcher.dispatchBatch(101, now)).resolves.toBe(100);

    expect(outboxRepository.claimNextAvailable).toHaveBeenCalledTimes(100);
    expect(assetEventsPublisher.publishAssetUploaded).toHaveBeenCalledTimes(
      100,
    );
  });
});
