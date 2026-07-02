import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { StaffRole, StaffStatus } from '../entities/staff.entity';

export class UpdateStaffDto {
  // name vive en el User vinculado; el servicio lo propaga.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUUID()
  barId?: string;

  @IsOptional()
  @IsEnum(StaffRole, { message: 'Rol de staff inválido' })
  role?: StaffRole;

  @IsOptional()
  @IsEnum(StaffStatus, { message: 'Estado inválido' })
  status?: StaffStatus;
}
