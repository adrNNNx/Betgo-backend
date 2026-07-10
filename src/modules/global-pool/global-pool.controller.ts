import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { GlobalPoolService } from './global-pool.service';
import { UpdateGlobalPoolDto } from './dto/update-global-pool.dto';
import { AdjustPoolDto } from './dto/adjust-pool.dto';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { UserRole } from '../users/entities/user.entity';

@Controller('global-pool')
export class GlobalPoolController {
  constructor(private readonly globalPoolService: GlobalPoolService) {}

  /** Instancia del pozo (hero + KPIs). Público: los jugadores ven el pozo. */
  @Get()
  @Public()
  getPool() {
    return this.globalPoolService.getPool();
  }

  /** Igual que GET / pero con detalle completo del ganador. Solo admin. */
  @Get('admin')
  @Roles(UserRole.ADMIN)
  getPoolAdmin() {
    return this.globalPoolService.getPoolAdmin();
  }

  /** Ajuste manual del pozo. POST /global-pool/adjust */
  @Post('adjust')
  @Roles(UserRole.ADMIN)
  adjust(@Body() dto: AdjustPoolDto, @CurrentUser('id') adminId: string) {
    return this.globalPoolService.adjust(dto, adminId);
  }

  /** Guardar config (costo por tirada, mínimo). PATCH /global-pool/:id */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  updateConfig(
    @Param('id') _id: string,
    @Body() dto: UpdateGlobalPoolDto,
  ) {
    return this.globalPoolService.updateConfig(dto);
  }
}
