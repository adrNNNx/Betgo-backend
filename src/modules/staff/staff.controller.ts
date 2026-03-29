// src/modules/staff/staff.controller.ts
import { Controller, Get } from '@nestjs/common';
import { StaffService } from './staff.service';
import { CurrentUser, Roles } from '../auth/decorators';
import { User, UserRole } from '../users/entities/user.entity';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  /**
   * Obtener perfil del staff del usuario autenticado.
   * GET /staff/me
   *
   * Retorna: { id, role, bar: { id, name, slug, logoUrl }, user: { id, name, phone } }
   *
   * Solo accesible para usuarios con rol STAFF o ADMIN.
   */
  @Get('me')
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  async getMyProfile(@CurrentUser() user: User) {
    return this.staffService.getMyProfile(user.id);
  }
}
