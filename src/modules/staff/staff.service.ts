// src/modules/staff/staff.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import type { Transaction } from 'sequelize';
import { Staff, StaffStatus } from './entities/staff.entity';
import { Bar } from '../bars/entities/bar.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { toDbPhone } from '../../common/utils/phone.util';
import { RefreshToken } from '../auth/entities/refresh-token.entity';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Includes reutilizados para devolver la forma que espera la tabla del panel.
const STAFF_INCLUDES = [
  { model: Bar, attributes: ['id', 'name'] },
  { model: User, attributes: ['id', 'name', 'phone', 'email'] },
];

@Injectable()
export class StaffService {
  constructor(
    @InjectModel(Staff)
    private readonly staffModel: typeof Staff,
    @InjectModel(User)
    private readonly userModel: typeof User,
    private readonly sequelize: Sequelize,
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

  // ==================== ADMIN: LISTADO / ALTA / EDICIÓN ====================

  /**
   * Listar el staff (tabla del panel), paginado. Filtro opcional por bar.
   * GET /staff?barId=&limit=&offset= → { data, total }
   */
  async findAll(query: { barId?: string; limit?: number; offset?: number }) {
    const limit =
      query.limit && query.limit > 0
        ? Math.min(query.limit, MAX_LIMIT)
        : DEFAULT_LIMIT;
    const offset = query.offset && query.offset > 0 ? query.offset : 0;

    const { rows, count } = await this.staffModel.findAndCountAll({
      where: query.barId ? { barId: query.barId } : {},
      include: STAFF_INCLUDES,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return { data: rows.map((s) => this.format(s)), total: count };
  }

  /**
   * Alta de staff. Resuelve el usuario por `identifier` (UUID / email / teléfono):
   *  - si existe, lo vincula (y lo promueve a rol STAFF si era player);
   *  - si no existe, lo crea (requiere `password` e identifier tipo teléfono).
   */
  async create(dto: CreateStaffDto) {
    const staffId = await this.sequelize.transaction(async (t) => {
      let user = await this.resolveUser(dto.identifier, t);

      if (user) {
        const existing = await this.staffModel.findOne({
          where: { userId: user.id },
          transaction: t,
        });
        if (existing) {
          throw new ConflictException('El usuario ya es parte del staff.');
        }
        // Alta = staff ACTIVE: promueve a STAFF si era player, completa el
        // nombre si faltaba y reactiva el login (user.isActive) por si estaba dado de baja.
        const userPatch: Partial<User> = { isActive: true };
        if (dto.name && !user.name) userPatch.name = dto.name;
        if (user.role === UserRole.PLAYER) userPatch.role = UserRole.STAFF;
        await user.update(userPatch, { transaction: t });
      } else {
        // Crear (invitar). Sin flujo de reset por email, exigimos password
        // para que el usuario nuevo pueda loguear.
        if (!dto.password) {
          throw new BadRequestException(
            'El usuario no existe. Enviá "password" para crearlo.',
          );
        }
        const phone = toDbPhone(dto.identifier);
        if (!phone) {
          throw new BadRequestException(
            'Para crear un usuario nuevo, el identifier debe ser un teléfono válido (ej: 0981234567).',
          );
        }
        // passwordHash crudo: el hook @BeforeCreate del User lo hashea.
        user = await this.userModel.create(
          {
            phone,
            email: dto.email ?? null,
            name: dto.name ?? null,
            passwordHash: dto.password,
            role: UserRole.STAFF,
            isActive: true,
          },
          { transaction: t },
        );
      }

      const staff = await this.staffModel.create(
        {
          userId: user.id,
          role: dto.role,
          barId: dto.barId ?? null,
          isActive: true,
          status: StaffStatus.ACTIVE,
        },
        { transaction: t },
      );
      return staff.id;
    });

    return this.findFormatted(staffId);
  }

  /**
   * Editar staff: name (del user vinculado), barId, role y status.
   * status es la fuente de verdad; isActive se deriva (active -> true).
   * PATCH /staff/:id
   */
  async update(id: string, dto: UpdateStaffDto) {
    const staff = await this.staffModel.findByPk(id, { include: [User] });
    if (!staff) {
      throw new NotFoundException('Staff no encontrado.');
    }

    await this.sequelize.transaction(async (t) => {
      const patch: Partial<Staff> = {};
      if (dto.barId !== undefined) patch.barId = dto.barId;
      if (dto.role !== undefined) patch.role = dto.role;
      if (dto.status !== undefined) {
        patch.status = dto.status;
        // Gate de acciones de staff (recargar, entregar premios, etc.): solo ACTIVE.
        patch.isActive = dto.status === StaffStatus.ACTIVE;
      }
      if (Object.keys(patch).length > 0) {
        await staff.update(patch, { transaction: t });
      }

      // Gate de login (user.isActive): bloqueado solo si SUSPENDED.
      const userPatch: Partial<User> = {};
      if (dto.name !== undefined) userPatch.name = dto.name;
      if (dto.status !== undefined) {
        userPatch.isActive = dto.status !== StaffStatus.SUSPENDED;
      }
      if (Object.keys(userPatch).length > 0) {
        await staff.user.update(userPatch, { transaction: t });
      }
    });

    // Suspender debe cerrar sesión ya: invalida los refresh tokens emitidos
    // (el access token dura poco y expira solo).
    if (dto.status === StaffStatus.SUSPENDED) {
      await RefreshToken.revokeAllUserTokens(staff.userId);
    }

    return this.findFormatted(id);
  }

  // ==================== PRIVADOS ====================

  private async findFormatted(id: string) {
    const staff = await this.staffModel.findByPk(id, {
      include: STAFF_INCLUDES,
    });
    return this.format(staff!);
  }

  private format(s: Staff) {
    return {
      id: s.id,
      role: s.role,
      isActive: s.isActive,
      status: s.status,
      barId: s.barId,
      bar: s.bar ? { id: s.bar.id, name: s.bar.name } : null,
      user: s.user
        ? {
            id: s.user.id,
            name: s.user.name,
            phone: s.user.phone,
            email: s.user.email,
          }
        : null,
    };
  }

  private async resolveUser(
    identifier: string,
    transaction: Transaction,
  ): Promise<User | null> {
    const value = identifier.trim();
    if (UUID_RE.test(value)) {
      return this.userModel.findByPk(value, { transaction });
    }
    if (value.includes('@')) {
      return this.userModel.findOne({
        where: { email: value.toLowerCase() },
        transaction,
      });
    }
    // Normaliza igual que el registro; si no es un teléfono válido, no hay match.
    const dbPhone = toDbPhone(value);
    if (!dbPhone) return null;
    return this.userModel.findOne({ where: { phone: dbPhone }, transaction });
  }
}
