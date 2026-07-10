import { IsNumber, IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Ajuste manual del pozo. `amount` es un delta con signo (+ suma, - resta).
// `notes` es obligatorio: todo ajuste manual debe quedar justificado.
export class AdjustPoolDto {
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser numérico' })
  amount: number;

  @IsString()
  @IsNotEmpty({ message: 'El motivo del ajuste es obligatorio' })
  @MaxLength(255)
  notes: string;
}
