import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AssetStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { AssetEventService } from './asset-events.service.js';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assetEventService: AssetEventService,
  ) {}

  async create(createAssetDto: CreateAssetDto) {
    return this.prisma.$transaction(async (transaction) => {
      const asset = await transaction.asset.create({
        data: {
          ...createAssetDto,
          storageKey: `assets/${randomUUID()}`,
        },
      });

      const event = this.assetEventService.createAssetUploadedEvent(asset);

      await transaction.outboxEvent.create({
        data: {
          id: event.eventId,
          type: event.type,
          payload: {
            ...event,
            data: {
              ...event.data,
            },
          },
        },
      });

      return asset;
    });
  }

  findAll() {
    return this.prisma.asset.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: {
        id,
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    return asset;
  }

  async markProcessing(id: string) {
    const [asset] = await this.prisma.asset.updateManyAndReturn({
      where: {
        id,
        status: AssetStatus.PENDING,
      },
      data: {
        status: AssetStatus.PROCESSING,
      },
    });

    if (asset) {
      return asset;
    }

    const existingAsset = await this.prisma.asset.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
      },
    });

    if (!existingAsset) {
      throw new NotFoundException('Asset not found');
    }

    throw new ConflictException('Asset cannot transition to processing');
  }
}
