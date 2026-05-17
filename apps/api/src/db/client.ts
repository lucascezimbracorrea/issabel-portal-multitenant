import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema.js';

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'admin',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'issabel_portal',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '+00:00',
});

export const db = drizzle(pool, { schema, mode: 'default' });
export { pool };
