import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { appConfig } from './config/app.config.js';
import { environmentValidationSchema } from './config/environment.validation.js';
import { HealthModule } from './health/health.module.js';
import { databaseConfig } from './config/database.config.js';
import { AssetsModule } from './assets/assets.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: '../../.env',
      load: [appConfig, databaseConfig],
      validationSchema: environmentValidationSchema,
    }),
    HealthModule,
    AssetsModule,
  ],
})
export class AppModule {}
