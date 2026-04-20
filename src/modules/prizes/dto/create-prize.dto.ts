import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  MaxLength,
  Min,
  IsString,
} from 'class-validator';

export class CreatePrizeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  /**
   * ID del bar al que pertenece.
   * - null/undefined → premio GLOBAL (jackpot)  → type = JACKPOT automático
   * - uuid           → premio LOCAL del bar      → type = LOCAL automático
   */
  @IsOptional()
  @IsUUID()
  barId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value?: number;

  /**
   * Stock disponible. null = ilimitado.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
