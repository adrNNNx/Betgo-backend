import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { User, UserRole } from './entities/user.entity';
import { toDbPhone } from '../../common/utils/phone.util';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export interface UserListItem {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {}

  /**
   * Listado para el panel admin (selector de usuarios). Paginado { data, total }.
   *
   * `search` busca en nombre, email y teléfono. El teléfono se compara de dos
   * formas: parcial sobre lo guardado (`981234`) y normalizado igual que el
   * registro, para que `0981234567` encuentre a `+595981234567`.
   *
   * Nunca expone passwordHash: los atributos van en lista blanca.
   */
  async findAll(query: {
    search?: string;
    role?: UserRole;
    limit?: number;
    offset?: number;
  }): Promise<{ data: UserListItem[]; total: number }> {
    const limit =
      query.limit && query.limit > 0
        ? Math.min(query.limit, MAX_LIMIT)
        : DEFAULT_LIMIT;
    const offset = query.offset && query.offset > 0 ? query.offset : 0;

    const where: WhereOptions<User> = {};
    if (query.role) Object.assign(where, { role: query.role });

    const search = query.search?.trim();
    if (search) {
      const like = { [Op.iLike]: `%${search}%` };
      const or: WhereOptions<User>[] = [
        { name: like },
        { email: like },
        { phone: like },
      ];
      const dbPhone = toDbPhone(search);
      if (dbPhone) or.push({ phone: dbPhone });
      Object.assign(where, { [Op.or]: or });
    }

    const { rows, count } = await this.userModel.findAndCountAll({
      where,
      attributes: [
        'id',
        'name',
        'phone',
        'email',
        'role',
        'isActive',
        'lastLoginAt',
        'createdAt',
      ],
      order: [
        ['name', 'ASC'],
        ['createdAt', 'DESC'],
      ],
      limit,
      offset,
    });

    return {
      data: rows.map((u) => ({
        id: u.id,
        name: u.name,
        phone: u.phone,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      })),
      total: count,
    };
  }
}
