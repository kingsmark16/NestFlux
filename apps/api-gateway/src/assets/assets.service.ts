import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { randomUUID } from 'node:crypto';

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
}
