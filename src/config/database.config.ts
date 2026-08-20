// src/config/database.config.ts
// ============================================================
// Configuración de Sequelize para Nest.js
// ============================================================

import { SequelizeModuleOptions } from '@nestjs/sequelize';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): SequelizeModuleOptions => ({
  dialect: 'postgres',
  host: configService.get<string>('DB_HOST', 'localhost'),
  port: configService.get<number>('DB_PORT', 5432),
  username: configService.get<string>('DB_USERNAME', 'betgo'),
  password: configService.get<string>('DB_PASSWORD', ''),
  database: configService.get<string>('DB_DATABASE', 'betgo_db'),

  autoLoadModels: true,
  synchronize: false,

  // Apagado por defecto: el SQL crudo tapa los logs de la app.
  // Para depurar una query, DB_LOGGING=true en el .env.
  logging:
    configService.get<string>('DB_LOGGING') === 'true' ? console.log : false,

  pool: {
    max: 10,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },

  define: {
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});
