import { IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

// Config editable del pozo desde el panel (costo por tirada, mínimo).
export class UpdateGlobalPoolDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El costo debe ser numérico' })
  @IsPositive({ message: 'El costo por tirada debe ser mayor a 0' })
  costPerPlay?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El mínimo debe ser numérico' })
  @Min(0, { message: 'El mínimo no puede ser negativo' })
  minAmount?: number;
}
