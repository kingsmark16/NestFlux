import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { AssetsService } from './assets.service.js';

describe('AssetsService', () => {
  let service: AssetsService;

  const prisma = {
    asset: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
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

  beforeEach(async () => {
    prisma.asset.create.mockReset();
    prisma.asset.findMany.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get(AssetsService);
  });

  it('creates a pending asset with a server-generated storage key', async () => {
    prisma.asset.create.mockResolvedValue(asset);

    await expect(
      service.create({
        originalFilename: 'sunset.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
      }),
    ).resolves.toEqual(asset);

    expect(prisma.asset.create).toHaveBeenCalledWith({
      data: {
        originalFilename: 'sunset.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
        storageKey: expect.stringMatching(/^assets\//),
      },
    });
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
});
