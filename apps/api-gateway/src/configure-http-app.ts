import { type INestApplication, ValidationPipe } from '@nestjs/common';

export function configureHttpApp(
  app: INestApplication,
  apiPrefix: string,
): void {
  app.setGlobalPrefix(apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    }),
  );
}
