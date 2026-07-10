import { Controller, Get, Query } from '@nestjs/common';
import { PoolMovementsService } from './pool-movements.service';
import type { MovementCategory } from './pool-movements.service';
import { Roles } from '../auth/decorators';
import { UserRole } from '../users/entities/user.entity';

@Controller('pool-movements')
export class PoolMovementsController {
  constructor(private readonly poolMovementsService: PoolMovementsService) {}

  /**
   * Historial paginado del pozo.
   * GET /pool-movements?limit=&offset=&category=&search=
   */
  @Get()
  @Roles(UserRole.ADMIN)
  findAll(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('category') category?: MovementCategory,
    @Query('search') search?: string,
  ) {
    return this.poolMovementsService.findAll({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      category,
      search: search || undefined,
    });
  }
}
