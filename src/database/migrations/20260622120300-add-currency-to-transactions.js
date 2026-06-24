'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('transactions', 'currency', {
      type: Sequelize.STRING(3), // ISO 4217 (PYG, USD, ...)
      allowNull: false,
      defaultValue: 'PYG',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('transactions', 'currency');
  },
};
