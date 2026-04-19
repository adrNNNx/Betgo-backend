'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('banners', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        primaryKey: true,
        allowNull: false,
      },
      bar_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'bars',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      title: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      image_url: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      public_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      link_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      display_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      starts_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ends_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('banners', ['bar_id'], {
      name: 'idx_banners_bar_id',
    });

    await queryInterface.addIndex('banners', ['is_active'], {
      name: 'idx_banners_is_active',
    });

    await queryInterface.addIndex('banners', ['starts_at', 'ends_at'], {
      name: 'idx_banners_schedule',
    });

    await queryInterface.addIndex(
      'banners',
      ['is_active', 'starts_at', 'ends_at', 'display_order'],
      { name: 'idx_banners_public_feed' },
    );

    await queryInterface.sequelize.query(`
      COMMENT ON TABLE banners IS 'Banners publicitarios del carrusel (globales y por bar)';
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('banners');
  },
};
