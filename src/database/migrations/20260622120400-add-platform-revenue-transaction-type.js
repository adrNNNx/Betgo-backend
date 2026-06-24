'use strict';

// Agrega el valor 'platform_revenue' al enum de transactions.type.
// Postgres no permite quitar valores de un enum, por eso el down es no-op.
// ADD VALUE IF NOT EXISTS lo hace idempotente.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "transaction_type" ADD VALUE IF NOT EXISTS 'platform_revenue';`,
    );
  },

  async down() {
    // No-op: Postgres no soporta remover valores de un enum.
  },
};
