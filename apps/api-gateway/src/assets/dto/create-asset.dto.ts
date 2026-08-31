import { Type } from 'class-transformer';
import {
  IsInt,
  IsMimeType,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAssetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  originalFilename!: string;

  @IsMimeType()
  contentType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  sizeBytes!: number;
}
