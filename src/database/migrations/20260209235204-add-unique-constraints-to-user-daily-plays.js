// src/database/migrations/20260209235204-add-unique-constraints-to-user-daily-plays.js

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Eliminar posibles duplicados existentes
    await queryInterface.sequelize.query(`
      DELETE FROM user_daily_plays
      WHERE id NOT IN (
        SELECT DISTINCT ON (bar_id, play_date, COALESCE(user_id::text, device_fingerprint, 'unknown')) id
        FROM user_daily_plays
        ORDER BY bar_id, play_date, COALESCE(user_id::text, device_fingerprint, 'unknown'), id
      );
    `);

    // 2. Crear índice único para usuarios registrados
    await queryInterface.addIndex(
      'user_daily_plays',
      ['bar_id', 'play_date', 'user_id'],
      {
        unique: true,
        name: 'unique_user_daily_play',
        where: {
          user_id: {
            [Sequelize.Op.ne]: null,
          },
        },
      },
    );

    // 3. Crear índice único para dispositivos anónimos
    await queryInterface.addIndex(
      'user_daily_plays',
      ['bar_id', 'play_date', 'device_fingerprint'],
      {
        unique: true,
        name: 'unique_device_daily_play',
        where: {
          device_fingerprint: {
            [Sequelize.Op.ne]: null,
          },
        },
      },
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex(
      'user_daily_plays',
      'unique_user_daily_play',
    );
    await queryInterface.removeIndex(
      'user_daily_plays',
      'unique_device_daily_play',
    );
  },
};
