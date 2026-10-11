import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db/client';
import { users, accounts } from '@/db/schema';
import { exportUserData } from '@/lib/export';
import { commitImport, previewImport } from '@/lib/import/importer';
import { categories, transactions, budgets } from '@/db/schema';
import fixture from '../fixtures/backup-fixture.json';

let userA: { id: string }, userB: { id: string };

beforeAll(async () => {
  [userA] = await db.insert(users).values({ email: 'export-a@example.com', passwordHash: 'x' }).returning();
  [userB] = await db.insert(users).values({ email: 'export-b@example.com', passwordHash: 'x' }).returning();
  await db.insert(accounts).values([
    { userId: userA.id, name: 'A Account', type: 'bank', currency: 'USD', startingBalance: '0' },
    { userId: userB.id, name: 'B Account', type: 'bank', currency: 'USD', startingBalance: '0' },
  ]);
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(budgets);
  await db.delete(categories);
  await db.delete(accounts);
  await db.delete(users);
});

describe('exportUserData', () => {
  it('exports only the requesting user\'s data in backup-compatible shape', async () => {
    const backup = await exportUserData(userA.id);
    expect(backup.accounts).toHaveLength(1);
    expect(backup.accounts[0].name).toBe('A Account');
    expect(backup).not.toHaveProperty('passwordHash');
  });

  it('round-trips: an imported backup exports to a file that previews cleanly with the same counts', async () => {
    const [user] = await db.insert(users).values({ email: 'export-roundtrip@example.com', passwordHash: 'x' }).returning();
    await commitImport(fixture, user.id);

    const exported = JSON.parse(JSON.stringify(await exportUserData(user.id)));
    const preview = previewImport(exported);

    expect(preview.errors).toEqual([]);
    expect(preview.warnings).toEqual([]);
    expect(preview.counts).toEqual({ accounts: 3, categories: 2, transactions: 3, budgets: 1 });
  });
});
