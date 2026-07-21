'use strict';

// Tipos para el movimiento de saldo bar <-> mozo:
//   staff_allocation → el admin asigna saldo del bar al mozo
//   staff_return     → el admin devuelve saldo del mozo al bar
// Postgres no permite quitar valores de un enum, por eso el down es no-op.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "transaction_type" ADD VALUE IF NOT EXISTS 'staff_allocation';`,
    );
    await queryInterface.sequelize.query(
      `ALTER TYPE "transaction_type" ADD VALUE IF NOT EXISTS 'staff_return';`,
    );
  },

  async down() {
    // No-op: Postgres no soporta remover valores de un enum.
  },
};
