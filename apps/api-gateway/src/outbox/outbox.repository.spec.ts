import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { OutboxRepository } from './outbox.repository.js';

describe('OutboxRepository', () => {
  const now = new Date('2026-09-01T02:00:00.000Z');

  const claimedEvent = {
    id: 'event_123',
    type: 'asset.uploaded',
    payload: {
      type: 'asset.uploaded',
      eventId: 'event_123',
    },
    status: 'PROCESSING',
    attempts: 1,
    availableAt: new Date('2026-09-01T01:00:00.000Z'),
    lockedAt: now,
    publishedAt: null,
    lastError: null,
    createdAt: new Date('2026-09-01T01:00:00.000Z'),
    updatedAt: now,
  };

  const prisma = {
    outboxEvent: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      updateManyAndReturn: vi.fn(),
    },
  };

  let repository: OutboxRepository;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxRepository,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    repository = module.get(OutboxRepository);
  });

  it('returns null when no event is available', async () => {
    prisma.outboxEvent.findFirst.mockResolvedValue(null);

    await expect(repository.claimNextAvailable(now)).resolves.toBeNull();

    expect(prisma.outboxEvent.findFirst).toHaveBeenCalledWith({
      where: {
        status: 'PENDING',
        availableAt: {
          lte: now,
        },
      },
      orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
      },
    });
    expect(prisma.outboxEvent.updateManyAndReturn).not.toHaveBeenCalled();
  });

  it('atomically claims the oldest available pending event', async () => {
    prisma.outboxEvent.findFirst.mockResolvedValue({
      id: claimedEvent.id,
    });
    prisma.outboxEvent.updateManyAndReturn.mockResolvedValue([claimedEvent]);

    await expect(repository.claimNextAvailable(now)).resolves.toEqual(
      claimedEvent,
    );

    expect(prisma.outboxEvent.updateManyAndReturn).toHaveBeenCalledWith({
      where: {
        id: claimedEvent.id,
        status: 'PENDING',
        availableAt: {
          lte: now,
        },
      },
      data: {
        status: 'PROCESSING',
        lockedAt: now,
        attempts: {
          increment: 1,
        },
      },
    });
  });

  it('retries when another dispatcher wins the claim race', async () => {
    const competingEventId = 'event_claimed_elsewhere';

    prisma.outboxEvent.findFirst
      .mockResolvedValueOnce({ id: competingEventId })
      .mockResolvedValueOnce({ id: claimedEvent.id });
    prisma.outboxEvent.updateManyAndReturn
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([claimedEvent]);

    await expect(repository.claimNextAvailable(now)).resolves.toEqual(
      claimedEvent,
    );

    expect(prisma.outboxEvent.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.outboxEvent.updateManyAndReturn).toHaveBeenCalledTimes(2);
  });

  it('marks an owned claim as published', async () => {
    const publishedAt = new Date('2026-09-01T02:00:01.000Z');
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      repository.markPublished(claimedEvent.id, now, publishedAt),
    ).resolves.toBe(true);

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: {
        id: claimedEvent.id,
        status: 'PROCESSING',
        lockedAt: now,
      },
      data: {
        status: 'PUBLISHED',
        lockedAt: null,
        publishedAt,
        lastError: null,
      },
    });
  });

  it('returns false when the publisher no longer owns the claim', async () => {
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 0 });

    await expect(repository.markPublished(claimedEvent.id, now)).resolves.toBe(
      false,
    );
  });

  it('releases an owned claim for a delayed retry', async () => {
    const availableAt = new Date('2026-09-01T02:00:05.000Z');
    const longError = 'x'.repeat(2100);
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      repository.releaseForRetry(claimedEvent.id, now, availableAt, longError),
    ).resolves.toBe(true);

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: {
        id: claimedEvent.id,
        status: 'PROCESSING',
        lockedAt: now,
      },
      data: {
        status: 'PENDING',
        lockedAt: null,
        availableAt,
        lastError: 'x'.repeat(2000),
      },
    });
  });

  it('releases claims whose leases have expired', async () => {
    const staleBefore = new Date('2026-09-01T01:55:00.000Z');
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 2 });

    await expect(repository.releaseStaleClaims(staleBefore, now)).resolves.toBe(
      2,
    );

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: {
        status: 'PROCESSING',
        OR: [
          {
            lockedAt: null,
          },
          {
            lockedAt: {
              lte: staleBefore,
            },
          },
        ],
      },
      data: {
        status: 'PENDING',
        lockedAt: null,
        availableAt: now,
        lastError: 'Claim expired before publication',
      },
    });
  });
});
