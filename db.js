const Pool = require('pg').Pool;
require('dotenv').config();

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "candidate_management",
  password: "9669",
  port: 5432
});

module.exports = pool;
