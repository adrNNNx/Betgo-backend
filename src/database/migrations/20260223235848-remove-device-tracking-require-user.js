'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Eliminar registros de user_daily_plays que no tienen user_id
    // (jugadas de usuarios anónimos que ya no serán soportadas)
    await queryInterface.sequelize.query(
      `DELETE FROM user_daily_plays WHERE user_id IS NULL`,
    );

    // 2. Eliminar índice antiguo de device_fingerprint
    await queryInterface.sequelize
      .query(
        `
      DROP INDEX IF EXISTS unique_device_daily_play;
    `,
      )
      .catch(() => {});

    // 3. Eliminar columnas de device tracking de user_daily_plays
    await queryInterface
      .removeColumn('user_daily_plays', 'device_fingerprint')
      .catch(() => {});
    await queryInterface
      .removeColumn('user_daily_plays', 'ip_address')
      .catch(() => {});

    // 4. Hacer user_id NOT NULL en user_daily_plays
    await queryInterface.changeColumn('user_daily_plays', 'user_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // 5. Crear nuevo índice único simplificado
    await queryInterface.addIndex(
      'user_daily_plays',
      ['bar_id', 'play_date', 'user_id'],
      {
        name: 'unique_user_bar_daily_play',
        unique: true,
      },
    );

    // 6. Eliminar columnas de device tracking de plays (opcional, mantener para auditoría)
    // Decidimos mantener device_fingerprint e ip_address en plays para auditoría
    // pero ya no son requeridos para el funcionamiento
  },

  async down(queryInterface, Sequelize) {
    // Revertir: agregar columnas de device tracking

    // 1. Agregar columnas de vuelta a user_daily_plays
    await queryInterface.addColumn('user_daily_plays', 'device_fingerprint', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.addColumn('user_daily_plays', 'ip_address', {
      type: Sequelize.INET,
      allowNull: true,
    });

    // 2. Hacer user_id nullable de nuevo
    await queryInterface.changeColumn('user_daily_plays', 'user_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    });

    // 3. Recrear índice de device
    await queryInterface
      .removeIndex('user_daily_plays', 'unique_user_bar_daily_play')
      .catch(() => {});

    await queryInterface.addIndex(
      'user_daily_plays',
      ['bar_id', 'play_date', 'device_fingerprint'],
      {
        name: 'unique_device_daily_play',
        unique: true,
        where: {
          device_fingerprint: { [Sequelize.Op.ne]: null },
        },
      },
    );
  },
};
