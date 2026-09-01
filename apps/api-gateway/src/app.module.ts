import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './config/app.config.js';
import { environmentValidationSchema } from './config/environment.validation.js';
import { HealthModule } from './health/health.module.js';
import { databaseConfig } from './config/database.config.js';
import { AssetsModule } from './assets/assets.module.js';
import { rabbitmqConfig } from './config/rabbitmq.config.js';
import { OutboxModule } from './outbox/outbox.module.js';
import { outboxConfig } from './config/outbox.config.js';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: '../../.env',
      load: [appConfig, databaseConfig, rabbitmqConfig, outboxConfig],
      validationSchema: environmentValidationSchema,
    }),
    ScheduleModule.forRoot(),
    HealthModule,
    AssetsModule,
    OutboxModule,
  ],
})
export class AppModule {}
