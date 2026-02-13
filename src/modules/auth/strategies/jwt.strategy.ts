// src/modules/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../../users/entities/user.entity';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { JWT_STRATEGY_NAME, AUTH_CONSTANTS } from '../constants/auth.constants';
import { RefreshToken } from '../entities/refresh-token.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, JWT_STRATEGY_NAME) {
  constructor(
    private configService: ConfigService,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(RefreshToken)
    private refreshTokenModel: typeof RefreshToken,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error(
        'JWT_SECRET no está configurado en las variables de entorno',
      );
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    // Verificar que es un access token
    if (payload.type !== 'access') {
      throw new UnauthorizedException(AUTH_CONSTANTS.ERRORS.INVALID_TOKEN);
    }

    if (payload.sessionId) {
      const session = await this.refreshTokenModel.findByPk(payload.sessionId);

      if (!session || session.isRevoked) {
        throw new UnauthorizedException(AUTH_CONSTANTS.ERRORS.SESSION_REVOKED);
      }

      if (session.isExpired()) {
        throw new UnauthorizedException(AUTH_CONSTANTS.ERRORS.SESSION_EXPIRED);
      }
    }

    // Buscar usuario en la BD
    const user = await this.userModel.findByPk(payload.sub, {
      attributes: { exclude: ['passwordHash'] },
    });

    if (!user) {
      throw new UnauthorizedException(AUTH_CONSTANTS.ERRORS.USER_NOT_FOUND);
    }

    if (!user.isActive) {
      throw new UnauthorizedException(AUTH_CONSTANTS.ERRORS.USER_INACTIVE);
    }

    return user;
  }
}
