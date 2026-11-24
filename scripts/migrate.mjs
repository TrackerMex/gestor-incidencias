import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('Define DATABASE_URL antes de ejecutar la migración.');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
  console.log('Esquema de PostgreSQL aplicado.');
} finally {
  await pool.end();
}
