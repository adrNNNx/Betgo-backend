// src/modules/recharge-codes/dto/recharge-code.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator';
import { PaymentMethod } from '../../transactions/entities/transaction.entity';

/**
 * DTO para validar un código de recarga (mozo escanea o ingresa manualmente).
 * POST /recharge-codes/validate
 */
export class ValidateCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;
}

/**
 * DTO para ejecutar la carga de saldo (mozo confirma).
 * POST /recharge-codes/load
 */
export class LoadBalanceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @IsNumber()
  @Min(50000, { message: 'El monto mínimo de recarga es Gs. 50.000' })
  amount: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
