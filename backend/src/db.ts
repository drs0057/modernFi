import { Pool } from 'pg';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// An idle client can error, for example when Postgres restarts. Without a
// listener that 'error' event is unhandled and kills the process.
pool.on('error', (err) => console.error('pg pool error', err));
