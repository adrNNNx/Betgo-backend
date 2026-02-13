// src/database/migrations/XXXXXX-create-refresh-tokens-table.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Crear tabla refresh_tokens
    await queryInterface.createTable('refresh_tokens', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      token: {
        type: Sequelize.STRING(500),
        allowNull: false,
        unique: true,
      },
      token_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      is_revoked: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      device_info: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      ip_address: {
        type: Sequelize.INET,
        allowNull: true,
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // 2. Crear índices
    await queryInterface.addIndex('refresh_tokens', ['user_id'], {
      name: 'idx_refresh_tokens_user_id',
    });

    await queryInterface.addIndex('refresh_tokens', ['token_hash'], {
      name: 'idx_refresh_tokens_token_hash',
    });

    await queryInterface.addIndex('refresh_tokens', ['expires_at'], {
      name: 'idx_refresh_tokens_expires_at',
    });

    await queryInterface.addIndex('refresh_tokens', ['is_revoked'], {
      name: 'idx_refresh_tokens_is_revoked',
    });

    // Índice compuesto para limpieza de tokens expirados
    await queryInterface.addIndex(
      'refresh_tokens',
      ['is_revoked', 'expires_at'],
      {
        name: 'idx_refresh_tokens_cleanup',
      },
    );

    // 3. Agregar comentario a la tabla
    await queryInterface.sequelize.query(`
      COMMENT ON TABLE refresh_tokens IS 'Tokens de refresco para autenticación JWT';
    `);
  },

  async down(queryInterface, Sequelize) {
    // Eliminar tabla (los índices se eliminan automáticamente)
    await queryInterface.dropTable('refresh_tokens');
  },
};
