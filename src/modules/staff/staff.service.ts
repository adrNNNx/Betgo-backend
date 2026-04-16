// src/modules/staff/staff.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Staff } from './entities/staff.entity';
import { Bar } from '../bars/entities/bar.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class StaffService {
  constructor(
    @InjectModel(Staff)
    private readonly staffModel: typeof Staff,
  ) {}

  /**
   * Uso interno — para que otros servicios (ej. PrizeClaimsService)
   * resuelvan el Staff activo a partir del userId del JWT.
   * Lanza ForbiddenException si no existe o está inactivo.
   */
  async findActiveByUserId(userId: string): Promise<Staff> {
    const staff = await this.staffModel.findOne({
      where: { userId, isActive: true },
    });

    if (!staff) {
      throw new ForbiddenException(
        'No tienes permisos de staff o tu cuenta está inactiva.',
      );
    }

    return staff;
  }

  /**
   * Obtener perfil del staff por userId (del JWT).
   * Incluye info del bar asignado y datos del usuario.
   *
   * Este endpoint es llamado por el panel del mozo al cargar
   * para saber a qué bar pertenece y mostrar el contexto.
   */
  async getMyProfile(userId: string) {
    const staff = await this.staffModel.findOne({
      where: { userId, isActive: true },
      include: [
        {
          model: Bar,
          attributes: ['id', 'name', 'slug', 'logoUrl'],
        },
        {
          model: User,
          attributes: ['id', 'name', 'phone', 'email'],
        },
      ],
    });

    if (!staff) {
      throw new NotFoundException(
        'No tienes un perfil de staff activo asignado.',
      );
    }

    return {
      id: staff.id,
      role: staff.role,
      bar: staff.bar
        ? {
            id: staff.bar.id,
            name: staff.bar.name,
            slug: staff.bar.slug,
            logoUrl: staff.bar.logoUrl,
          }
        : null,
      user: {
        id: staff.user.id,
        name: staff.user.name,
        phone: staff.user.phone,
      },
    };
  }
}
