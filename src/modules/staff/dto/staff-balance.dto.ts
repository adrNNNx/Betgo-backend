import { IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

/** Monto a asignar/devolver del saldo del mozo. */
export class StaffBalanceDto {
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser numérico' })
  @IsPositive({ message: 'El monto debe ser mayor a 0' })
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
