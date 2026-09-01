import { Injectable, Logger } from '@nestjs/common';
import type { AssetUploadedEvent } from '@nestflux/contracts';
import type { OutboxEvent } from '../generated/prisma/client.js';
import { AssetEventsPublisher } from '../messaging/asset-event.publisher.js';
import { OutboxRepository } from './outbox.repository.js';

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 100;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 60_000;

@Injectable()
export class OutboxDispatcher {
  private readonly logger = new Logger(OutboxDispatcher.name);

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly assetEventsPublisher: AssetEventsPublisher,
  ) {}

  async dispatchBatch(
    batchSize = DEFAULT_BATCH_SIZE,
    now = new Date(),
  ): Promise<number> {
    const boundedBatchSize = Math.min(
      Math.max(Math.trunc(batchSize), 0),
      MAX_BATCH_SIZE,
    );

    let claimedCount = 0;

    for (let index = 0; index < boundedBatchSize; index += 1) {
      const outboxEvent = await this.outboxRepository.claimNextAvailable(now);

      if (!outboxEvent) {
        break;
      }

      claimedCount += 1;
      await this.dispatchClaimedEvent(outboxEvent, now);
    }

    return claimedCount;
  }

  private async dispatchClaimedEvent(
    outboxEvent: OutboxEvent,
    now: Date,
  ): Promise<void> {
    const { lockedAt } = outboxEvent;

    if (!lockedAt) {
      throw new Error(`Claimed outbox event ${outboxEvent.id} has no lock`);
    }

    try {
      const event = this.readAssetUploadedEvent(outboxEvent);

      await this.assetEventsPublisher.publishAssetUploaded(event);

      const markedPublished = await this.outboxRepository.markPublished(
        outboxEvent.id,
        lockedAt,
        now,
      );

      if (!markedPublished) {
        this.logger.warn(
          `Lost ownership after publishing outbox event ${outboxEvent.id}`,
        );
      }
    } catch (error) {
      const availableAt = new Date(
        now.getTime() + this.retryDelayMilliseconds(outboxEvent.attempts),
      );

      const released = await this.outboxRepository.releaseForRetry(
        outboxEvent.id,
        lockedAt,
        availableAt,
        this.describeError(error),
      );

      if (released) {
        this.logger.error(
          `Failed to publish outbox event ${outboxEvent.id}; retry scheduled`,
        );
      } else {
        this.logger.warn(
          `Lost ownership while handling outbox event ${outboxEvent.id}`,
        );
      }
    }
  }

  private readAssetUploadedEvent(outboxEvent: OutboxEvent): AssetUploadedEvent {
    const payload = outboxEvent.payload;

    if (
      outboxEvent.type !== 'asset.uploaded' ||
      typeof payload !== 'object' ||
      payload === null ||
      Array.isArray(payload) ||
      payload.type !== outboxEvent.type ||
      payload.eventId !== outboxEvent.id
    ) {
      throw new Error(`Invalid payload for outbox event ${outboxEvent.id}`);
    }

    return payload as unknown as AssetUploadedEvent;
  }

  private retryDelayMilliseconds(attempts: number): number {
    return Math.min(
      BASE_RETRY_DELAY_MS * 2 ** Math.max(0, attempts - 1),
      MAX_RETRY_DELAY_MS,
    );
  }

  private describeError(error: unknown): string {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown outbox publication error';

    return message.replace(/(amqps?:\/\/[^:\s]+:)[^@\s]+@/gi, '$1[redacted]@');
  }
}
