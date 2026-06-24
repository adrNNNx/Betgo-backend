import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Currency } from '../../transactions/entities/transaction.entity';

export class RechargeBarDto {
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser numérico' })
  @IsPositive({ message: 'El monto debe ser mayor a 0' })
  amount: number;

  @IsOptional()
  @IsEnum(Currency, { message: 'Moneda no soportada' })
  currency?: Currency = Currency.PYG;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
