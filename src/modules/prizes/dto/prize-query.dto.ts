import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PrizeType } from '../entities/prize.entity';

export class PrizeQueryDto {
  @IsOptional()
  @IsUUID()
  barId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isGlobal?: boolean;

  @IsOptional()
  @IsEnum(PrizeType)
  type?: PrizeType;
}
