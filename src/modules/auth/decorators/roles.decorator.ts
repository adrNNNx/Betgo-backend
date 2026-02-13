// src/modules/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../constants/auth.constants';
import { UserRole } from '../../users/entities/user.entity';

/**
 * Decorador para restringir acceso por roles
 * 
 * @example
 * @Roles(UserRole.ADMIN)
 * @Get('admin-only')
 * adminEndpoint() { ... }
 * 
 * @example
 * @Roles(UserRole.ADMIN, UserRole.STAFF)
 * @Get('staff-area')
 * staffEndpoint() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
