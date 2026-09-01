import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { OutboxDispatcher } from './outbox-dispatcher.service.js';
import { OutboxRepository } from './outbox.repository.js';
import { OutboxScheduler } from './outbox-scheduler.service.js';
@Module({
  imports: [DatabaseModule, MessagingModule],
  providers: [OutboxRepository, OutboxDispatcher, OutboxScheduler],
  exports: [OutboxRepository, OutboxDispatcher],
})
export class OutboxModule {}
