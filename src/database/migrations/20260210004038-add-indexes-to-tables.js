// src/database/migrations/XXXXXX-add-indexes-to-tables.js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Eliminar duplicados si existen
    await queryInterface.sequelize.query(`
      DELETE FROM tables
      WHERE id NOT IN (
        SELECT MIN(id::text)::uuid
        FROM tables
        GROUP BY bar_id, number
      );
    `);

    // 2. Agregar índice único compuesto: bar_id + number
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_table_number_per_bar
      ON tables (bar_id, number);
    `);

    // 3. Índice en slug
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_tables_slug
      ON tables (slug);
    `);

    // 4. Índice en is_active
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_tables_is_active
      ON tables (is_active);
    `);

    // 5. Índice compuesto para queries comunes: bar_id + is_active
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_tables_bar_active
      ON tables (bar_id, is_active);
    `);

    // 6. Agregar trigger para updated_at
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger 
          WHERE tgname = 'update_tables_updated_at'
        ) THEN
          CREATE TRIGGER update_tables_updated_at
            BEFORE UPDATE ON tables
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END $$;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revertir en orden inverso
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS update_tables_updated_at ON tables;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_tables_bar_active;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_tables_is_active;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_tables_slug;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS unique_table_number_per_bar;
    `);
  },
};
