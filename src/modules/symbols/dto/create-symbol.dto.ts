// src/modules/symbols/dto/create-symbol.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateSymbolDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  imageUrl: string;

  /**
   * ID del bar al que pertenece.
   * - null/undefined → símbolo GLOBAL (puede entregar el pozo si isJackpot)
   * - uuid → símbolo LOCAL del bar → isJackpot se fuerza a false
   */
  @IsOptional()
  @IsUUID()
  barId?: string | null;

  @IsOptional()
  @IsUUID()
  prizeId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  weight?: number;

  /** Desde cuántos iguales paga. 3-4 = premio menor, 5 = sólo con los cinco. */
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(5)
  minMatchToWin?: number;

  /** Si entrega el pozo global con 5 iguales. Se ignora en símbolos de bar. */
  @IsOptional()
  @IsBoolean()
  isJackpot?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
