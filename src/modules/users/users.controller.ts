import { Controller, Get, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../auth/decorators';
import { UserRole } from './entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Listado de usuarios para el panel admin.
   * GET /users?search=&role=&limit=&offset=  →  { data, total }
   */
  @Get()
  @Roles(UserRole.ADMIN)
  findAll(
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.usersService.findAll({
      search: search || undefined,
      role: Object.values(UserRole).includes(role as UserRole)
        ? role
        : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }
}
