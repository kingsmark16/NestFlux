import { ConfigModule, registerAs } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import { Test, type TestingModule } from '@nestjs/testing';
import { AssetEventsPublisher } from './asset-event.publisher.js';
import { MessagingModule } from './messaging.module.js';
import { ASSET_EVENTS_CLIENT } from './messaging.tokens.js';

describe('MessagingModule', () => {
  let moduleRef: TestingModule | undefined;

  afterEach(async () => {
    await moduleRef?.close();
  });

  it('registers the asset events RabbitMQ client', async () => {
    const testRabbitmqConfig = registerAs('rabbitmq', () => ({
      url: 'amqp://user:password@localhost:5672/nestflux',
      assetQueue: 'asset-processing',
    }));

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [testRabbitmqConfig],
        }),
        MessagingModule,
      ],
    }).compile();

    expect(moduleRef.get<ClientProxy>(ASSET_EVENTS_CLIENT)).toBeDefined();
    expect(moduleRef.get(AssetEventsPublisher)).toBeInstanceOf(
      AssetEventsPublisher,
    );
  });
});
