import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ASSET_EVENTS_CLIENT } from './messaging.tokens.js';
import { AssetEventsPublisher } from './asset-event.publisher.js';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: ASSET_EVENTS_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.getOrThrow<string>('rabbitmq.url')],
            queue: configService.getOrThrow<string>('rabbitmq.assetQueue'),
            queueOptions: {
              durable: true,
            },
            persistent: true,
          },
        }),
      },
    ]),
  ],
  providers: [AssetEventsPublisher],
  exports: [ClientsModule, AssetEventsPublisher],
})
export class MessagingModule {}
