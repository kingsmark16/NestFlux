import type { INestApplication } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { appConfig } from '../src/config/app.config.js';
import { configureHttpApp } from '../src/configure-http-app.js';
import { PrismaService } from '../src/database/prisma.service.js';

describe('API Gateway (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let createdAssetId: string | undefined;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
    configureHttpApp(app, config.apiPrefix);

    prisma = app.get(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    if (createdAssetId) {
      await prisma.asset.delete({
        where: {
          id: createdAssetId,
        },
      });
    }

    await app.close();
  });

  it('/api/v1/health/live (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('/api/v1/health/ready (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('/api/v1/assets (POST) creates and lists an asset', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/assets')
      .send({
        originalFilename: 'sunset.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
      })
      .expect(201);

    createdAssetId = createResponse.body.id;

    expect(createResponse.body).toMatchObject({
      originalFilename: 'sunset.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      status: 'PENDING',
      storageKey: expect.stringMatching(/^assets\//),
    });

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/assets')
      .expect(200);

    expect(listResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createdAssetId,
        }),
      ]),
    );
  });

  it('/api/v1/assets (POST) rejects invalid input', () => {
    return request(app.getHttpServer())
      .post('/api/v1/assets')
      .send({
        originalFilename: '',
        contentType: 'not a MIME type',
        sizeBytes: 0,
        storageKey: 'client-selected-key',
      })
      .expect(400);
  });
});
