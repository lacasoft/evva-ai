import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'Missing DATABASE_URL. Set it to your PostgreSQL connection string (e.g. postgresql://user:pass@localhost:5432/evva).',
    );
  }

  pool = new Pool({ connectionString });

  return pool;
}

/** Ejecuta una query y retorna las rows tipadas */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const { rows } = await getPool().query(text, params);
  return rows as T[];
}

/** Ejecuta una query y retorna la primera row o null */
export async function queryOne<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Para tests — permite inyectar un pool mock */
export function setPool(mockPool: pg.Pool): void {
  pool = mockPool;
}

export function resetPool(): void {
  pool = null;
}

/** Cierra el pool de conexiones */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
