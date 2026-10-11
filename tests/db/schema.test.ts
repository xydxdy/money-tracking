// tests/db/schema.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '@/db/schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL_TEST });
const db = drizzle(pool, { schema });

beforeAll(async () => {
  await migrate(db, { migrationsFolder: './db/migrations' });
});

describe('schema', () => {
  it('inserts a user and a linked account', async () => {
    const [user] = await db.insert(schema.users).values({
      email: 'schema-test@example.com',
      passwordHash: 'hash',
    }).returning();

    const [account] = await db.insert(schema.accounts).values({
      userId: user.id,
      name: 'Test Bank',
      currency: 'USD',
      startingBalance: '100.00',
    }).returning();

    expect(account.userId).toBe(user.id);
    expect(account.startingBalance).toBe('100.00');

    await db.delete(schema.accounts);
    await db.delete(schema.users);
  });
});
