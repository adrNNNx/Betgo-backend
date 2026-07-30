'use strict';

// El premio lo define el SÍMBOLO, no un nivel global: cada símbolo dice qué
// premio da (symbols.prize_id, ya existía) y desde cuántos carriles iguales lo
// paga (min_match_to_win, nuevo). Default 5 = sólo paga con los 5, que es la
// conducta histórica: migrar no cambia nada hasta que un admin lo baje.
//
// Además `is_jackpot` deja de derivarse del bar_id. Antes significaba "es un
// símbolo global"; ahora significa "este símbolo entrega el POZO". Como el
// pozo es plata compartida entre todos los bares, arrancan todos en false:
// nadie lo gana hasta que un admin elija explícitamente cuáles lo dan.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('symbols', 'min_match_to_win', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 5,
    });

    // La slot tiene 5 carriles: con menos de 3 iguales no hay combinación.
    await queryInterface.sequelize.query(`
      ALTER TABLE symbols
        ADD CONSTRAINT symbols_min_match_to_win_check
        CHECK (min_match_to_win BETWEEN 3 AND 5);
    `);

    // Fail closed: el pozo no se entrega hasta que se configure a mano.
    await queryInterface.sequelize.query(
      `UPDATE symbols SET is_jackpot = false;`,
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('symbols', 'min_match_to_win');
    // is_jackpot vuelve a su viejo significado ("es global").
    await queryInterface.sequelize.query(
      `UPDATE symbols SET is_jackpot = (bar_id IS NULL);`,
    );
  },
};
