import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

type HealthResponse = {
  status: 'ok';
};

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  live(): HealthResponse {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<HealthResponse> {
    const databaseIsHealthy = await this.prisma.isHealthy();

    if (!databaseIsHealthy) {
      throw new ServiceUnavailableException('Database is unavailable');
    }

    return {
      status: 'ok',
    };
  }
}
