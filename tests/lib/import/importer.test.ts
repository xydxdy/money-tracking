import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, categories, transactions, budgets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { previewImport, commitImport } from '@/lib/import/importer';
import fixture from '../../fixtures/backup-fixture.json';
import realBackup from '../../../docs/finance-backup-2026-09-28.json';

let userId: string;
let secondUserId: string | undefined;

afterEach(async () => {
  for (const id of [secondUserId]) {
    if (!id) continue;
    await db.delete(transactions).where(eq(transactions.userId, id));
    await db.delete(budgets).where(eq(budgets.userId, id));
    await db.delete(categories).where(eq(categories.userId, id));
    await db.delete(accounts).where(eq(accounts.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }
  secondUserId = undefined;
  if (!userId) return;
  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.delete(budgets).where(eq(budgets.userId, userId));
  await db.delete(categories).where(eq(categories.userId, userId));
  await db.delete(accounts).where(eq(accounts.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
});

describe('previewImport', () => {
  it('reports counts and flags the dangling account reference as a warning, not an error', () => {
    const preview = previewImport(fixture);
    expect(preview.counts).toEqual({ accounts: 2, categories: 2, transactions: 3, budgets: 1 });
    expect(preview.errors).toHaveLength(0);
    expect(preview.warnings.some((w) => w.includes('dangling-account'))).toBe(true);
  });

  it('flags a transaction referencing a missing category as an error', () => {
    const broken = { ...fixture, transactions: [{ ...fixture.transactions[0], categoryId: 'c_missing' }] };
    const preview = previewImport(broken);
    expect(preview.errors.some((e) => e.includes('c_missing'))).toBe(true);
  });

  it('flags a budget referencing a missing category as an error', () => {
    const broken = { ...fixture, budgets: [{ ...fixture.budgets[0], categoryId: 'c_missing' }] };
    const preview = previewImport(broken);
    expect(preview.errors.some((e) => e.includes('c_missing'))).toBe(true);
  });

  it('flags duplicate ids as errors', () => {
    const broken = { ...fixture, accounts: [...fixture.accounts, fixture.accounts[0]] };
    const preview = previewImport(broken);
    expect(preview.errors.some((e) => e.includes('duplicate account id'))).toBe(true);
  });
});

describe('commitImport', () => {
  it('imports all rows under the authenticated user, ignoring any user_id from the JSON, and recovers the dangling account', async () => {
    const [user] = await db.insert(users).values({ email: 'importer@example.com', passwordHash: 'x' }).returning();
    userId = user.id;

    const result = await commitImport(fixture, userId);

    expect(result.imported).toEqual({ accounts: 3, categories: 2, transactions: 3, budgets: 1 }); // +1 recovered account
    const importedAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));
    expect(importedAccounts.every((a) => a.userId === userId)).toBe(true);

    const importedTxns = await db.select().from(transactions).where(eq(transactions.userId, userId));
    expect(importedTxns).toHaveLength(3);

    // Relationships survive the id remap: the lunch expense still points at the imported Checking account
    // and the Food category.
    const lunch = importedTxns.find((t) => t.details === 'Lunch')!;
    const checking = importedAccounts.find((a) => a.name === 'Checking')!;
    const importedCats = await db.select().from(categories).where(eq(categories.userId, userId));
    expect(lunch.fromAccountId).toBe(checking.id);
    expect(lunch.categoryId).toBe(importedCats.find((c) => c.name === 'Food')!.id);
    const payoff = importedTxns.find((t) => t.details === 'Pay off card')!;
    expect(importedAccounts.find((a) => a.id === payoff.toAccountId)!.name).toMatch(/^Recovered Account/);
  });

  it('lets a second user import the same backup without id collisions', async () => {
    const [user] = await db.insert(users).values({ email: 'importer-a@example.com', passwordHash: 'x' }).returning();
    userId = user.id;
    const [second] = await db.insert(users).values({ email: 'importer-b@example.com', passwordHash: 'x' }).returning();
    secondUserId = second.id;

    await commitImport(fixture, userId);
    const result = await commitImport(fixture, second.id);

    expect(result.imported.transactions).toBe(3);
    const secondTxns = await db.select().from(transactions).where(eq(transactions.userId, second.id));
    expect(secondTxns).toHaveLength(3);
  });

  it('rolls back entirely if any row is malformed', async () => {
    const [user] = await db.insert(users).values({ email: 'importer-fail@example.com', passwordHash: 'x' }).returning();
    userId = user.id;

    const broken = { ...fixture, transactions: [...fixture.transactions, { ...fixture.transactions[0], id: 'dup', amount: -5 }] };

    await expect(commitImport(broken, userId)).rejects.toThrow();

    const importedTxns = await db.select().from(transactions).where(eq(transactions.userId, userId));
    expect(importedTxns).toHaveLength(0);
  });

  it('commits the real backup file end to end', async () => {
    const [user] = await db.insert(users).values({ email: 'importer-real@example.com', passwordHash: 'x' }).returning();
    userId = user.id;

    const result = await commitImport(realBackup, userId);

    expect(result.imported).toEqual({ accounts: 17, categories: 23, transactions: 226, budgets: 32 });
    const importedTxns = await db.select().from(transactions).where(eq(transactions.userId, userId));
    expect(importedTxns).toHaveLength(226);
  });
});
