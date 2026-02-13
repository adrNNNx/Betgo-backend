// src/modules/auth/strategies/local.strategy.ts
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import {
  LOCAL_STRATEGY_NAME,
  AUTH_CONSTANTS,
} from '../constants/auth.constants';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { User } from 'src/modules/users/entities/user.entity';
import { LoginDto } from '../dto';

@Injectable()
export class LocalStrategy extends PassportStrategy(
  Strategy,
  LOCAL_STRATEGY_NAME,
) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'phone',
      passwordField: 'password',
      passReqToCallback: true,
    });
  }

  async validate(req: any, phone: string, password: string): Promise<User> {
    const loginDto = plainToClass(LoginDto, req.body);
    const errors = await validate(loginDto);

    if (errors.length > 0) {
      const messages = errors
        .map((error) => Object.values(error.constraints || {}).join(', '))
        .join('; ');

      throw new BadRequestException(messages);
    }

    const user = await this.authService.validateUser(
      loginDto.phone,
      loginDto.password,
    );

    if (!user) {
      throw new UnauthorizedException(
        AUTH_CONSTANTS.ERRORS.INVALID_CREDENTIALS,
      );
    }

    return user;
  }
}
