import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { OutboxDispatcher } from './outbox-dispatcher.service.js';
import { OutboxRepository } from './outbox.repository.js';

const OUTBOX_INTERVAL_NAME = 'outbox-dispatch';

@Injectable()
export class OutboxScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxScheduler.name);
  private dispatchInProgress = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly outboxRepository: OutboxRepository,
    private readonly outboxDispatcher: OutboxDispatcher,
  ) {}

  onApplicationBootstrap(): void {
    const dispatchEnabled = this.configService.getOrThrow<boolean>(
      'outbox.dispatchEnabled',
    );

    if (!dispatchEnabled) {
      this.logger.log('Automatic outbox dispatch is disabled');
      return;
    }

    const pollIntervalMs = this.configService.getOrThrow<number>(
      'outbox.pollIntervalMs',
    );

    const interval = setInterval(() => {
      void this.runOnce();
    }, pollIntervalMs);

    this.schedulerRegistry.addInterval(OUTBOX_INTERVAL_NAME, interval);

    void this.runOnce();
  }

  onApplicationShutdown(): void {
    if (this.schedulerRegistry.doesExist('interval', OUTBOX_INTERVAL_NAME)) {
      this.schedulerRegistry.deleteInterval(OUTBOX_INTERVAL_NAME);
    }
  }

  async runOnce(now = new Date()): Promise<number> {
    if (this.dispatchInProgress) {
      return 0;
    }

    this.dispatchInProgress = true;

    try {
      const claimTtlMs =
        this.configService.getOrThrow<number>('outbox.claimTtlMs');
      const batchSize =
        this.configService.getOrThrow<number>('outbox.batchSize');
      const staleBefore = new Date(now.getTime() - claimTtlMs);

      await this.outboxRepository.releaseStaleClaims(staleBefore, now);

      return await this.outboxDispatcher.dispatchBatch(batchSize, now);
    } catch {
      this.logger.error('Outbox dispatch cycle failed');
      return 0;
    } finally {
      this.dispatchInProgress = false;
    }
  }
}
