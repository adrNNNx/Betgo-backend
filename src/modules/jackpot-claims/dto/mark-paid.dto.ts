import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkPaidDto {
  /** Referencia del pago: comprobante de transferencia, quién lo entregó, etc. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
