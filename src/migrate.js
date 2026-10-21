import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sqlPath = fileURLToPath(new URL('../db/init.sql', import.meta.url));

try {
  const sql = await readFile(sqlPath, 'utf8');
  await pool.query(sql);
  console.log('Esquema y productos de ejemplo listos.');
} catch (error) {
  console.error('No se pudo inicializar la base de datos:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
