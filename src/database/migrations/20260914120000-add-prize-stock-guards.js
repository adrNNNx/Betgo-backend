'use strict';

// Stock de premios e idempotencia de comprobantes.
//
// 1) UNIQUE(play_id) en prize_claims. Una jugada otorga a lo sumo UN premio.
//    Si un reintento o un bug intentara crear un segundo comprobante para la
//    misma jugada, la base lo rechaza; sin esto cada duplicado reservaría otra
//    unidad de stock. No se borran datos: si ya hubiera duplicados la migración
//    frena y los lista, porque son comprobantes de jugadores y hay que decidir
//    a mano cuál vale.
//
// 2) Índice (prize_id, status, expires_at) para contar los comprobantes que
//    reservan stock. Ese conteo corre dentro de cada jugada ganadora con la
//    fila del premio bloqueada, así que tiene que ser barato: el orden cubre la
//    igualdad de los dos primeros campos y el rango sobre el tercero.
//
// 3) CHECK stock >= 0. La app descuenta de forma condicional, pero un UPDATE
//    manual o un bug futuro no debería poder dejar stock negativo: con stock
//    negativo el disponible nunca vuelve a ser positivo y nadie entiende por
//    qué el premio dejó de salir. Antes se normalizan los negativos.
//
// Los índices se crean CONCURRENTLY para no frenar las escrituras a
// prize_claims mientras se construyen en producción; por eso esta migración no
// usa transacción. Y por eso antes de crear cada uno se borra un posible resto
// INVALID: si un CREATE INDEX CONCURRENTLY se corta a la mitad deja el índice
// marcado como inválido, y un IF NOT EXISTS lo daría por creado sin que proteja
// nada. Todo es re-ejecutable.

const UNIQUE_PLAY = 'prize_claims_play_id_unique';
const STOCK_INDEX = 'prize_claims_prize_status_expires_idx';
const STOCK_CHECK = 'prizes_stock_non_negative_check';

async function dropInvalidIndex(queryInterface, name) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT 1
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
      WHERE c.relname = :name AND NOT i.indisvalid`,
    { replacements: { name } },
  );
  if (rows.length > 0) {
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS ${name};`,
    );
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [duplicados] = await queryInterface.sequelize.query(`
      SELECT play_id, COUNT(*)::int AS comprobantes
        FROM prize_claims
       GROUP BY play_id
      HAVING COUNT(*) > 1;
    `);
    if (duplicados.length > 0) {
      throw new Error(
        'prize_claims tiene jugadas con más de un comprobante. ' +
          'Resolvelas a mano antes de migrar: ' +
          JSON.stringify(duplicados),
      );
    }

    await dropInvalidIndex(queryInterface, UNIQUE_PLAY);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ${UNIQUE_PLAY}
        ON prize_claims (play_id);
    `);

    await dropInvalidIndex(queryInterface, STOCK_INDEX);
    await queryInterface.sequelize.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS ${STOCK_INDEX}
        ON prize_claims (prize_id, status, expires_at);
    `);

    await queryInterface.sequelize.query(
      `UPDATE prizes SET stock = 0 WHERE stock < 0;`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE prizes DROP CONSTRAINT IF EXISTS ${STOCK_CHECK};`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE prizes
         ADD CONSTRAINT ${STOCK_CHECK} CHECK (stock IS NULL OR stock >= 0);`,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE prizes DROP CONSTRAINT IF EXISTS ${STOCK_CHECK};`,
    );
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS ${STOCK_INDEX};`,
    );
    await queryInterface.sequelize.query(
      `DROP INDEX CONCURRENTLY IF EXISTS ${UNIQUE_PLAY};`,
    );
    // La normalización de stock negativo no se revierte: eran valores inválidos.
  },
};
