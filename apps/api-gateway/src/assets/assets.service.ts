import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AssetStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createAssetDto: CreateAssetDto) {
    return this.prisma.asset.create({
      data: {
        ...createAssetDto,
        storageKey: `assets/${randomUUID()}`,
      },
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
