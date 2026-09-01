import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { AssetEventService } from './asset-events.service.js';
import { AssetsService } from './assets.service.js';

describe('AssetsService', () => {
  let service: AssetsService;

  const transaction = {
    asset: {
      create: vi.fn(),
    },
    outboxEvent: {
      create: vi.fn(),
    },
  };

  const prisma = {
    $transaction: vi.fn(),
    asset: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateManyAndReturn: vi.fn(),
    },
  };

  const assetEventService = {
    createAssetUploadedEvent: vi.fn(),
  };

  const asset = {
    id: 'asset_123',
    originalFilename: 'sunset.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 1024,
    storageKey: 'assets/generated-key',
    status: 'PENDING',
    createdAt: new Date('2026-08-31T00:00:00.000Z'),
    updatedAt: new Date('2026-08-31T00:00:00.000Z'),
  };

  const event = {
    type: 'asset.uploaded' as const,
    eventId: 'event_123',
    occurredAt: '2026-09-01T00:00:00.000Z',
    data: {
      assetId: asset.id,
      storageKey: asset.storageKey,
      originalFilename: asset.originalFilename,
      contentType: asset.contentType,
      sizeBytes: asset.sizeBytes,
    },
  };

  beforeEach(async () => {
    prisma.$transaction.mockReset();
    prisma.asset.findMany.mockReset();
    prisma.asset.findUnique.mockReset();
    prisma.asset.updateManyAndReturn.mockReset();
    transaction.asset.create.mockReset();
    transaction.outboxEvent.create.mockReset();
    assetEventService.createAssetUploadedEvent.mockReset();

    prisma.$transaction.mockImplementation(
      async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: AssetEventService,
          useValue: assetEventService,
        },
      ],
    }).compile();

    service = module.get(AssetsService);
  });

  it('creates a pending asset with a server-generated storage key', async () => {
    transaction.asset.create.mockResolvedValue(asset);
    transaction.outboxEvent.create.mockResolvedValue({});
    assetEventService.createAssetUploadedEvent.mockReturnValue(event);

    await expect(
      service.create({
        originalFilename: 'sunset.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
      }),
    ).resolves.toEqual(asset);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(transaction.asset.create).toHaveBeenCalledWith({
      data: {
        originalFilename: 'sunset.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
        storageKey: expect.stringMatching(/^assets\//),
      },
    });
    expect(assetEventService.createAssetUploadedEvent).toHaveBeenCalledWith(
      asset,
    );
    expect(transaction.outboxEvent.create).toHaveBeenCalledWith({
      data: {
        id: event.eventId,
        type: event.type,
        payload: event,
      },
    });
  });

  it('propagates an outbox insert failure through the transaction', async () => {
    const error = new Error('Outbox insert failed');
    transaction.asset.create.mockResolvedValue(asset);
    transaction.outboxEvent.create.mockRejectedValue(error);
    assetEventService.createAssetUploadedEvent.mockReturnValue(event);

    await expect(
      service.create({
        originalFilename: 'sunset.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
      }),
    ).rejects.toBe(error);
  });

  it('lists assets with newest records first', async () => {
    prisma.asset.findMany.mockResolvedValue([asset]);

    await expect(service.findAll()).resolves.toEqual([asset]);

    expect(prisma.asset.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('finds one asset by its primary key', async () => {
    prisma.asset.findUnique.mockResolvedValue(asset);

    await expect(service.findOne(asset.id)).resolves.toEqual(asset);

    expect(prisma.asset.findUnique).toHaveBeenCalledWith({
      where: {
        id: asset.id,
      },
    });
  });

  it('throws 404 when an asset does not exist', async () => {
    prisma.asset.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing_asset')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('transitions a pending asset to processing', async () => {
    const processingAsset = {
      ...asset,
      status: 'PROCESSING',
    };

    prisma.asset.updateManyAndReturn.mockResolvedValue([processingAsset]);

    await expect(service.markProcessing(asset.id)).resolves.toEqual(
      processingAsset,
    );

    expect(prisma.asset.updateManyAndReturn).toHaveBeenCalledWith({
      where: {
        id: asset.id,
        status: 'PENDING',
      },
      data: {
        status: 'PROCESSING',
      },
    });
  });

  it('throws 404 when a transition target does not exist', async () => {
    prisma.asset.updateManyAndReturn.mockResolvedValue([]);
    prisma.asset.findUnique.mockResolvedValue(null);

    await expect(
      service.markProcessing('missing_asset'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws 409 when an asset is no longer pending', async () => {
    prisma.asset.updateManyAndReturn.mockResolvedValue([]);
    prisma.asset.findUnique.mockResolvedValue({
      id: asset.id,
    });

    await expect(service.markProcessing(asset.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
