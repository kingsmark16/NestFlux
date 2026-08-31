import { Body, Controller, Get, Post } from '@nestjs/common';
import { AssetsService } from './assets.service.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';

@Controller('assets')
export class AssetsController {
  constructor(private readonly assetService: AssetsService) {}

  @Post()
  create(@Body() createAssetDto: CreateAssetDto) {
    return this.assetService.create(createAssetDto);
  }

  @Get()
  findAll() {
    return this.assetService.findAll();
  }
}
