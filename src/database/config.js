// src/database/config.js
require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USERNAME || 'betgo',
    password: process.env.DB_PASSWORD || 'betgo_secret_2026',
    database: process.env.DB_DATABASE || 'betgo_db',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    // sequelize-cli ya informa qué migración corrió; el SQL crudo solo estorba.
    // DB_LOGGING=true para verlo cuando una migración falla.
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
  },
  test: {
    username: process.env.DB_USERNAME || 'betgo',
    password: process.env.DB_PASSWORD || 'betgo_secret_2026',
    database: process.env.DB_DATABASE_TEST || 'betgo_db_test',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: false,
  },
  production: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};
