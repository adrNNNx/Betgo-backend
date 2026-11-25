import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ResetFreePlaysDto {
  /** Bar donde resetear. Sin barId se resetean TODOS los bares del jugador. */
  @IsOptional()
  @IsUUID(undefined, { message: 'Bar inválido' })
  barId?: string;

  /** Motivo del reset; queda en la auditoría. */
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'El motivo no puede superar los 255 caracteres' })
  reason?: string;
}
