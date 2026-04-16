// src/modules/prize-claims/dto/prize-claim.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
} from 'class-validator';

/**
 * DTO para validar un código de premio (mozo escanea o ingresa manualmente).
 * POST /prize-claims/validate
 */
export class ValidateClaimDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;
}

/**
 * DTO para marcar un premio como entregado.
 * POST /prize-claims/deliver
 */
export class DeliverPrizeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
