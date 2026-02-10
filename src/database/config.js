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
    logging: console.log,
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
