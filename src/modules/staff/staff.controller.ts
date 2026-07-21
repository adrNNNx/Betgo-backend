// src/modules/staff/staff.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffRole, StaffStatus } from './entities/staff.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffBalanceDto } from './dto/staff-balance.dto';
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

  /**
   * Listar el staff (tabla del panel), paginado. Filtro opcional por bar.
   * GET /staff?barId=&limit=&offset= → { data, total }
   */
  /** Totales para los KPIs del panel (la tabla está paginada). GET /staff/summary */
  @Get('summary')
  @Roles(UserRole.ADMIN)
  summary() {
    return this.staffService.summary();
  }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll(
    @Query('search') search?: string,
    @Query('barId') barId?: string,
    @Query('role') role?: StaffRole,
    @Query('status') status?: StaffStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.staffService.findAll({
      search: search || undefined,
      barId: barId || undefined,
      role: role || undefined,
      status: status || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  /**
   * Alta de staff: crea/vincula al usuario por identifier y lo asocia con role + barId.
   * POST /staff
   */
  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateStaffDto) {
    return this.staffService.create(dto);
  }

  /**
   * Editar staff: name / barId / role / status.
   * PATCH /staff/:id
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staffService.update(id, dto);
  }

  /**
   * Asignar saldo del bar al mozo (transferencia, tope = saldo del bar).
   * POST /staff/:id/recharge
   */
  @Post(':id/recharge')
  @Roles(UserRole.ADMIN)
  rechargeBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StaffBalanceDto,
  ) {
    return this.staffService.rechargeBalance(id, dto.amount, dto.notes);
  }

  /**
   * Devolver saldo del mozo al bar (tope = saldo del mozo).
   * POST /staff/:id/return
   */
  @Post(':id/return')
  @Roles(UserRole.ADMIN)
  returnBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StaffBalanceDto,
  ) {
    return this.staffService.returnBalance(id, dto.amount, dto.notes);
  }
}
