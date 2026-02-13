// src/modules/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';

export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as User;

    // Si se especifica una propiedad, devolver solo esa propiedad
    if (data) {
      return user?.[data];
    }

    return user;
  },
);

// Ejemplo de uso:
// @Get('profile')
// getProfile(@CurrentUser() user: User) { ... }
//
// @Get('my-id')
// getMyId(@CurrentUser('id') userId: string) { ... }
