import { describe, it, expect, vi, beforeEach } from 'vitest';
import pg from 'pg';
import { getPool, query, queryOne, setPool, resetPool, closePool } from '../client.js';

describe('client', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    resetPool();
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.DATABASE_URL;
  });

  describe('getPool()', () => {
    it('throws when DATABASE_URL is not set', () => {
      expect(() => getPool()).toThrowError('Missing DATABASE_URL');
    });

    it('returns a Pool when DATABASE_URL is set', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
      const pool = getPool();
      expect(pool).toBeDefined();
      expect(pool).toBeInstanceOf(pg.Pool);
    });

    it('returns the same instance on subsequent calls (singleton)', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
      const pool1 = getPool();
      const pool2 = getPool();
      expect(pool1).toBe(pool2);
    });
  });

  describe('query()', () => {
    it('returns rows from pool.query result', async () => {
      const mockQuery = vi.fn().mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
      });
      setPool({ query: mockQuery, end: vi.fn() } as unknown as pg.Pool);

      const result = await query('SELECT * FROM users');
      expect(result).toEqual([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]);
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users', undefined);
    });

    it('passes params to pool.query', async () => {
      const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [{ id: 1 }] });
      setPool({ query: mockQuery, end: vi.fn() } as unknown as pg.Pool);

      await query('SELECT * FROM users WHERE id = $1', [1]);
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
    });
  });

  describe('queryOne()', () => {
    it('returns the first row', async () => {
      const mockQuery = vi.fn().mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
      });
      setPool({ query: mockQuery, end: vi.fn() } as unknown as pg.Pool);

      const result = await queryOne('SELECT * FROM users');
      expect(result).toEqual({ id: 1, name: 'Alice' });
    });

    it('returns null when no rows are found', async () => {
      const mockQuery = vi.fn().mockResolvedValueOnce({ rows: [] });
      setPool({ query: mockQuery, end: vi.fn() } as unknown as pg.Pool);

      const result = await queryOne('SELECT * FROM users WHERE id = $1', [999]);
      expect(result).toBeNull();
    });
  });

  describe('resetPool()', () => {
    it('allows creating a new pool instance', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
      const pool1 = getPool();
      resetPool();
      const pool2 = getPool();
      expect(pool1).not.toBe(pool2);
    });
  });

  describe('closePool()', () => {
    it('calls pool.end() and resets the pool', async () => {
      const mockEnd = vi.fn().mockResolvedValueOnce(undefined);
      setPool({ query: vi.fn(), end: mockEnd } as unknown as pg.Pool);

      await closePool();
      expect(mockEnd).toHaveBeenCalledOnce();

      // After closing, getPool should throw since DATABASE_URL is not set
      expect(() => getPool()).toThrowError('Missing DATABASE_URL');
    });

    it('does nothing when no pool exists', async () => {
      // pool is already null after resetPool in beforeEach — should not throw
      await expect(closePool()).resolves.toBeUndefined();
    });
  });
});
