'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar campo access_code único para cada bar
    await queryInterface.addColumn('bars', 'access_code', {
      type: Sequelize.STRING(20),
      allowNull: true,
      unique: true,
    });

    // Agregar índice
    await queryInterface.addIndex('bars', ['access_code'], {
      name: 'idx_bars_access_code',
      unique: true,
    });

    // Generar códigos para bares existentes
    const [bars] = await queryInterface.sequelize.query(
      'SELECT id FROM bars WHERE access_code IS NULL',
    );

    for (const bar of bars) {
      const code = generateAccessCode();
      await queryInterface.sequelize.query(
        `UPDATE bars SET access_code = '${code}' WHERE id = '${bar.id}'`,
      );
    }

    // Hacer el campo NOT NULL después de generar códigos
    await queryInterface.changeColumn('bars', 'access_code', {
      type: Sequelize.STRING(20),
      allowNull: false,
      unique: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('bars', 'idx_bars_access_code');
    await queryInterface.removeColumn('bars', 'access_code');
  },
};

// Función auxiliar para generar código
function generateAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
