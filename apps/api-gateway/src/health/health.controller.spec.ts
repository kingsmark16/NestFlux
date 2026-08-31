import { ServiceUnavailableException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;

  const prisma = {
    isHealthy: vi.fn(),
  };

  beforeEach(async () => {
    prisma.isHealthy.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns ok when the database is healthy', async () => {
    prisma.isHealthy.mockResolvedValue(true);

    await expect(controller.ready()).resolves.toEqual({ status: 'ok' });
  });

  it('throws 503 when the database is unavailable', async () => {
    prisma.isHealthy.mockResolvedValue(false);

    await expect(controller.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
