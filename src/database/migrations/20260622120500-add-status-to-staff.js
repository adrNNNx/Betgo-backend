'use strict';

// Agrega el estado de 3 valores al staff (active/inactive/suspended).
// isActive se mantiene como gate de "puede operar" y queda sincronizado
// desde el servicio: active -> true, inactive/suspended -> false.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('staff', 'status', {
      type: Sequelize.ENUM('active', 'inactive', 'suspended'),
      allowNull: false,
      defaultValue: 'active',
    });

    // Backfill: los inactivos actuales pasan a status 'inactive'.
    await queryInterface.sequelize.query(
      `UPDATE staff SET status = 'inactive' WHERE is_active = false;`,
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('staff', 'status');
    // Elimina el tipo enum creado por addColumn (nombre por convención de Sequelize).
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_staff_status";`,
    );
  },
};
