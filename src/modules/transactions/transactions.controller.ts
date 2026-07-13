import { Controller, Get, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import type {
  TransactionCategory,
  TransactionFilters,
} from './transactions.service';
import { Roles } from '../auth/decorators';
import { UserRole } from '../users/entities/user.entity';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * Listado paginado. GET /transactions?category=&barId=&userId=&from=&to=&search=&limit=&offset=
   * (userId sirve para la actividad del jugador en el drawer.)
   */
  @Get()
  @Roles(UserRole.ADMIN)
  findAll(
    @Query('category') category?: TransactionCategory,
    @Query('barId') barId?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.transactionsService.findAll({
      ...this.parseFilters({ category, barId, userId, from, to, search }),
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  /** Resumen agregado (mismos filtros). GET /transactions/summary */
  @Get('summary')
  @Roles(UserRole.ADMIN)
  summary(
    @Query('category') category?: TransactionCategory,
    @Query('barId') barId?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
  ) {
    return this.transactionsService.summary(
      this.parseFilters({ category, barId, userId, from, to, search }),
    );
  }

  private parseFilters(q: {
    category?: TransactionCategory;
    barId?: string;
    userId?: string;
    from?: string;
    to?: string;
    search?: string;
  }): TransactionFilters {
    return {
      category: q.category,
      barId: q.barId || undefined,
      userId: q.userId || undefined,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      search: q.search || undefined,
    };
  }
}
