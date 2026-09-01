import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { OutboxDispatcher } from './outbox-dispatcher.service.js';
import { OutboxRepository } from './outbox.repository.js';
@Module({
  imports: [DatabaseModule, MessagingModule],
  providers: [OutboxRepository, OutboxDispatcher],
  exports: [OutboxRepository, OutboxDispatcher],
})
export class OutboxModule {}
