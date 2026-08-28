'use strict';

// Comprobante del pozo global. El pozo dejó de acreditarse al saldo: ahora se
// emite un folio y el pago se coordina manualmente con administración.
//
// Tabla propia y no prize_claims porque aquel exige prize_id (el pozo no tiene
// premio del catálogo, es sintético) y expires_at NOT NULL (el pozo no vence),
// y su auto-expirado marcaría estos comprobantes como vencidos.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('jackpot_claims', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
      },
      bar_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'bars', key: 'id' },
      },
      play_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'plays', key: 'id' },
      },
      // Folio J-XXXXXX que el ganador le pasa a administración.
      folio: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
      },
      // Monto adeudado, congelado al momento de ganar.
      amount: {
        type: Sequelize.DECIMAL(14, 2),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending_contact', 'in_review', 'paid'),
        allowNull: false,
        defaultValue: 'pending_contact',
      },
      contacted_at: { type: Sequelize.DATE, allowNull: true },
      paid_at: { type: Sequelize.DATE, allowNull: true },
      // Quién autorizó el pago (staff, igual que delivered_by_id en prize_claims).
      paid_by_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'staff', key: 'id' },
      },
      notes: { type: Sequelize.TEXT, allowNull: true },
      // Nullable a propósito: hoy el reclamo del pozo no vence.
      expires_at: { type: Sequelize.DATE, allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('jackpot_claims', ['status']);
    await queryInterface.addIndex('jackpot_claims', ['user_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('jackpot_claims');
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_jackpot_claims_status";`,
    );
  },
};
