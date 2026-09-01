import { Injectable } from '@nestjs/common';
import { OutboxEventStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async claimNextAvailable(now = new Date()) {
    while (true) {
      const candidate = await this.prisma.outboxEvent.findFirst({
        where: {
          status: OutboxEventStatus.PENDING,
          availableAt: {
            lte: now,
          },
        },
        orderBy: [
          {
            availableAt: 'asc',
          },
          {
            createdAt: 'asc',
          },
        ],
        select: {
          id: true,
        },
      });

      if (!candidate) {
        return null;
      }

      const [claimedEvent] = await this.prisma.outboxEvent.updateManyAndReturn({
        where: {
          id: candidate.id,
          status: OutboxEventStatus.PENDING,
          availableAt: {
            lte: now,
          },
        },
        data: {
          status: OutboxEventStatus.PROCESSING,
          lockedAt: now,
          attempts: {
            increment: 1,
          },
        },
      });

      if (claimedEvent) {
        return claimedEvent;
      }
    }
  }
  async markPublished(
    id: string,
    lockedAt: Date,
    publishedAt = new Date(),
  ): Promise<boolean> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        status: OutboxEventStatus.PROCESSING,
        lockedAt,
      },
      data: {
        status: OutboxEventStatus.PUBLISHED,
        lockedAt: null,
        publishedAt,
        lastError: null,
      },
    });

    return result.count === 1;
  }

  async releaseForRetry(
    id: string,
    lockedAt: Date,
    availableAt: Date,
    lastError: string,
  ): Promise<boolean> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        id,
        status: OutboxEventStatus.PROCESSING,
        lockedAt,
      },
      data: {
        status: OutboxEventStatus.PENDING,
        lockedAt: null,
        availableAt,
        lastError: lastError.slice(0, 2000),
      },
    });

    return result.count === 1;
  }

  async releaseStaleClaims(
    staleBefore: Date,
    availableAt = new Date(),
  ): Promise<number> {
    const result = await this.prisma.outboxEvent.updateMany({
      where: {
        status: OutboxEventStatus.PROCESSING,
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
        status: OutboxEventStatus.PENDING,
        lockedAt: null,
        availableAt,
        lastError: 'Claim expired before publication',
      },
    });

    return result.count;
  }
}
