'use strict';

// Saldo/float del mozo. El admin le transfiere saldo desde el bar (bar.balance
// baja, staff.balance sube) y el mozo carga a usuarios desde este saldo.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('staff', 'balance', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('staff', 'balance');
  },
};
