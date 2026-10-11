import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, accountTypes } from '@/db/schema';
import { exportUserData } from '@/lib/export';
import { commitImport, previewImport } from '@/lib/import/importer';
import { categories, transactions, budgets } from '@/db/schema';
import fixture from '../fixtures/backup-fixture.json';

let userA: { id: string }, userB: { id: string };

beforeAll(async () => {
  [userA] = await db.insert(users).values({ email: 'export-a@example.com', passwordHash: 'x' }).returning();
  [userB] = await db.insert(users).values({ email: 'export-b@example.com', passwordHash: 'x' }).returning();
  await db.insert(accounts).values([
    { userId: userA.id, name: 'A Account', currency: 'USD', startingBalance: '0' },
    { userId: userB.id, name: 'B Account', currency: 'USD', startingBalance: '0' },
  ]);
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(budgets);
  await db.delete(categories);
  await db.delete(accounts);
  await db.delete(accountTypes);
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

  it('exports format version 2 and round-trips the new reimbursement statuses', async () => {
    const [user] = await db.insert(users).values({ email: 'export-status@example.com', passwordHash: 'x' }).returning();
    const base = fixture.transactions[0];
    await commitImport({ ...fixture, version: 2, transactions: [
      { ...base, id: 'r1', details: 'sub', reimbursable: true, reimbursementStatus: 'submitting' },
      { ...base, id: 'r2', details: 'done', reimbursable: true, reimbursementStatus: 'claimed' },
    ] }, user.id);

    const exported = JSON.parse(JSON.stringify(await exportUserData(user.id)));
    expect(exported.version).toBe(2);
    const statuses = Object.fromEntries(exported.transactions.map((t: { details: string; reimbursementStatus?: string }) => [t.details, t.reimbursementStatus]));
    expect(statuses).toEqual({ sub: 'submitting', done: 'claimed' });
    expect(exported.categories.every((c: Record<string, unknown>) => !('noBudget' in c))).toBe(true);
  });

  it('round-trips transaction links', async () => {
    const [user] = await db.insert(users).values({ email: 'export-link@example.com', passwordHash: 'x' }).returning();
    const base = fixture.transactions[0];
    await commitImport({ ...fixture, version: 2, transactions: [{ ...base, id: 'l1', link: 'https://example.com/receipt.pdf' }] }, user.id);
    const exported = JSON.parse(JSON.stringify(await exportUserData(user.id)));
    expect(exported.transactions[0].link).toBe('https://example.com/receipt.pdf');
  });

  it('exports account colour and icon', async () => {
    const [user] = await db.insert(users).values({ email: 'export-appearance@example.com', passwordHash: 'x' }).returning();
    await commitImport({ ...fixture, version: 2, accounts: [{ ...fixture.accounts[0], color: 'violet', icon: '🏦' }], transactions: [], budgets: [] }, user.id);
    const exported = JSON.parse(JSON.stringify(await exportUserData(user.id)));
    expect(exported.accounts[0]).toMatchObject({ color: 'violet', icon: 'landmark' }); // emoji in the file -> icon name
  });

  it('exports each account type by name', async () => {
    const [user] = await db.insert(users).values({ email: 'export-types@example.com', passwordHash: 'x' }).returning();
    const [t] = await db.insert(accountTypes).values({ userId: user.id, name: 'Savings' }).returning();
    await db.insert(accounts).values({ userId: user.id, name: 'Piggy', accountTypeId: t.id, currency: 'USD', startingBalance: '0' });
    const exported = await exportUserData(user.id);
    expect(exported.accounts[0].type).toBe('Savings');
  });

  it('round-trips loan transactions', async () => {
    const [user] = await db.insert(users).values({ email: 'export-loan@example.com', passwordHash: 'x' }).returning();
    const base = fixture.transactions[0];
    await commitImport({ ...fixture, version: 2, transactions: [
      { ...base, id: 'ln1', details: 'Lent', type: 'loan', loanKind: 'lend', counterparty: 'Alice', categoryId: null, toAccountId: null, loanClosedAt: '2026-09-30T00:00:00.000Z' },
    ], budgets: [] }, user.id);
    const exported = JSON.parse(JSON.stringify(await exportUserData(user.id)));
    expect(exported.transactions[0]).toMatchObject({ type: 'loan', loanKind: 'lend', counterparty: 'Alice', loanClosedAt: '2026-09-30T00:00:00.000Z' });
    expect(previewImport(exported).errors).toEqual([]);
  });
});
