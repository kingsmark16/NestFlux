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
  let createdOutboxEventId: string | undefined;

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
    if (createdOutboxEventId) {
      await prisma.outboxEvent.deleteMany({
        where: {
          id: createdOutboxEventId,
        },
      });
    }

    if (createdAssetId) {
      await prisma.asset.deleteMany({
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

  it('/api/v1/assets (POST) creates an asset and its outbox event', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/assets')
      .send({
        originalFilename: 'sunset.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
      })
      .expect(201);

    const assetId = createResponse.body.id as string;
    createdAssetId = assetId;

    expect(createResponse.body).toMatchObject({
      id: assetId,
      originalFilename: 'sunset.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      status: 'PENDING',
      storageKey: expect.stringMatching(/^assets\//),
    });

    const findResponse = await request(app.getHttpServer())
      .get(`/api/v1/assets/${assetId}`)
      .expect(200);

    expect(findResponse.body).toMatchObject({
      id: createdAssetId,
      originalFilename: 'sunset.jpg',
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

    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: {
        type: 'asset.uploaded',
        payload: {
          path: ['data', 'assetId'],
          equals: assetId,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    createdOutboxEventId = outboxEvent?.id;

    expect(outboxEvent).toMatchObject({
      type: 'asset.uploaded',
      status: 'PENDING',
      attempts: 0,
      payload: {
        type: 'asset.uploaded',
        eventId: expect.any(String),
        occurredAt: expect.any(String),
        data: {
          assetId,
          storageKey: createResponse.body.storageKey,
          originalFilename: 'sunset.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 1024,
        },
      },
    });
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

  it('/api/v1/assets/:id (GET) returns 404 for an unknown asset', () => {
    return request(app.getHttpServer())
      .get('/api/v1/assets/missing_asset')
      .expect(404)
      .expect({
        message: 'Asset not found',
        error: 'Not Found',
        statusCode: 404,
      });
  });
});
