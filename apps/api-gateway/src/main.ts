import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ConfigType } from '@nestjs/config';
import { appConfig } from './config/app.config.js';
import { configureHttpApp } from './configure-http-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  configureHttpApp(app, config.apiPrefix);

  app.enableShutdownHooks();

  await app.listen(config.port);
}
await bootstrap();
