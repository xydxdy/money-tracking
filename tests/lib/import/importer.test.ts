import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, categories, transactions, budgets, accountTypes } from '@/db/schema';
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
    await db.delete(accountTypes).where(eq(accountTypes.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }
  secondUserId = undefined;
  if (!userId) return;
  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.delete(budgets).where(eq(budgets.userId, userId));
  await db.delete(categories).where(eq(categories.userId, userId));
  await db.delete(accounts).where(eq(accounts.userId, userId));
  await db.delete(accountTypes).where(eq(accountTypes.userId, userId));
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

  it("replaces the user's existing data instead of adding to it", async () => {
    const [user] = await db.insert(users).values({ email: 'importer-replace@example.com', passwordHash: 'x' }).returning();
    userId = user.id;
    const [oldAcc] = await db.insert(accounts).values({ userId, name: 'Old account', currency: 'USD', startingBalance: '0' }).returning();
    const [oldCat] = await db.insert(categories).values({ userId, name: 'Old category', type: 'expense' }).returning();
    await db.insert(transactions).values({ userId, details: 'Old txn', type: 'expense', payDate: '2026-01-01', fromAccountId: oldAcc.id, categoryId: oldCat.id, amount: '1.00', currency: 'USD' });
    await db.insert(budgets).values({ userId, month: '2026-01', categoryId: oldCat.id, currency: 'USD', plannedAmount: '5.00' });

    await commitImport(fixture, userId);
    await commitImport(fixture, userId); // importing twice must not duplicate

    const accs = await db.select().from(accounts).where(eq(accounts.userId, userId));
    const txns = await db.select().from(transactions).where(eq(transactions.userId, userId));
    const cats = await db.select().from(categories).where(eq(categories.userId, userId));
    const buds = await db.select().from(budgets).where(eq(budgets.userId, userId));
    expect(accs).toHaveLength(3);
    expect(txns).toHaveLength(3);
    expect(cats).toHaveLength(2);
    expect(buds).toHaveLength(1);
    expect(accs.some((a) => a.name === 'Old account')).toBe(false);
    expect(txns.some((t) => t.details === 'Old txn')).toBe(false);
  });

  it("keeps the user's existing data when the import is rejected", async () => {
    const [user] = await db.insert(users).values({ email: 'importer-keep@example.com', passwordHash: 'x' }).returning();
    userId = user.id;
    await db.insert(accounts).values({ userId, name: 'Keep me', currency: 'USD', startingBalance: '0' });

    const broken = { ...fixture, transactions: [{ ...fixture.transactions[0], amount: -5 }] };
    await expect(commitImport(broken, userId)).rejects.toThrow();

    const accs = await db.select().from(accounts).where(eq(accounts.userId, userId));
    expect(accs.map((a) => a.name)).toEqual(['Keep me']);
  });

  it("does not touch other users' data when replacing", async () => {
    const [user] = await db.insert(users).values({ email: 'importer-self@example.com', passwordHash: 'x' }).returning();
    userId = user.id;
    const [other] = await db.insert(users).values({ email: 'importer-bystander@example.com', passwordHash: 'x' }).returning();
    secondUserId = other.id;
    await db.insert(accounts).values({ userId: other.id, name: 'Bystander', currency: 'USD', startingBalance: '0' });

    await commitImport(fixture, userId);

    const otherAccs = await db.select().from(accounts).where(eq(accounts.userId, other.id));
    expect(otherAccs.map((a) => a.name)).toEqual(['Bystander']);
  });

  it('maps version 1 reimbursement statuses onto the new ones (claimed -> submitting, reimbursed -> claimed)', async () => {
    const [user] = await db.insert(users).values({ email: 'importer-v1-status@example.com', passwordHash: 'x' }).returning();
    userId = user.id;
    const base = fixture.transactions[0];
    const v1 = { ...fixture, version: 1, transactions: [
      { ...base, id: 's1', details: 'was to_claim', reimbursable: true, reimbursementStatus: 'to_claim' },
      { ...base, id: 's2', details: 'was claimed', reimbursable: true, reimbursementStatus: 'claimed' },
      { ...base, id: 's3', details: 'was reimbursed', reimbursable: true, reimbursementStatus: 'reimbursed' },
    ] };
    expect(previewImport(v1).errors).toEqual([]);
    await commitImport(v1, userId);
    const rows = await db.select().from(transactions).where(eq(transactions.userId, userId));
    const status = Object.fromEntries(rows.map((r) => [r.details, r.reimbursementStatus]));
    expect(status).toEqual({ 'was to_claim': 'to_claim', 'was claimed': 'submitting', 'was reimbursed': 'claimed' });
  });

  it('keeps version 2 statuses as they are and rejects old names in a version 2 file', async () => {
    const [user] = await db.insert(users).values({ email: 'importer-v2-status@example.com', passwordHash: 'x' }).returning();
    userId = user.id;
    const base = fixture.transactions[0];
    const v2 = { ...fixture, version: 2, transactions: [
      { ...base, id: 's1', details: 'submitting', reimbursable: true, reimbursementStatus: 'submitting' },
      { ...base, id: 's2', details: 'claimed', reimbursable: true, reimbursementStatus: 'claimed' },
    ] };
    await commitImport(v2, userId);
    const rows = await db.select().from(transactions).where(eq(transactions.userId, userId));
    expect(Object.fromEntries(rows.map((r) => [r.details, r.reimbursementStatus]))).toEqual({ submitting: 'submitting', claimed: 'claimed' });

    const bad = { ...v2, transactions: [{ ...base, reimbursable: true, reimbursementStatus: 'reimbursed' }] };
    expect(previewImport(bad).errors.length).toBeGreaterThan(0);
  });

  it('imports categories with or without the retired noBudget flag', () => {
    const withoutFlag = { ...fixture, version: 2, categories: fixture.categories.map((c) => ({ id: c.id, name: c.name, type: c.type, icon: c.icon })) };
    expect(previewImport(withoutFlag).errors).toEqual([]);
    expect(previewImport(fixture).errors).toEqual([]);
  });

  it('rejects an unsafe link in a backup file', () => {
    const bad = { ...fixture, transactions: [{ ...fixture.transactions[0], link: 'javascript:alert(1)' }] };
    expect(previewImport(bad).errors.length).toBeGreaterThan(0);
  });

  it('gives imported accounts a default icon and colour, or keeps the ones in the file', async () => {
    const [user] = await db.insert(users).values({ email: 'importer-appearance@example.com', passwordHash: 'x' }).returning();
    userId = user.id;
    const file = { ...fixture, version: 2, accounts: [{ ...fixture.accounts[0], color: 'emerald', icon: '🐷' }, fixture.accounts[1]] };
    await commitImport(file, userId);
    const accs = await db.select().from(accounts).where(eq(accounts.userId, userId));
    expect(accs.find((a) => a.name === 'Checking')).toMatchObject({ color: 'emerald', icon: '🐷' });
    expect(accs.find((a) => a.name === 'Credit')).toMatchObject({ icon: '💳' });
    expect(accs.every((a) => a.color && a.icon)).toBe(true);
  });

  it('rejects an account colour outside the palette', () => {
    const bad = { ...fixture, accounts: [{ ...fixture.accounts[0], color: 'url(javascript:x)' }] };
    expect(previewImport(bad).errors.length).toBeGreaterThan(0);
  });

  it("maps account types onto the user's own types: legacy keys, existing names, and new names", async () => {
    const [user] = await db.insert(users).values({ email: 'importer-types@example.com', passwordHash: 'x' }).returning();
    userId = user.id;
    const [mine] = await db.insert(accountTypes).values({ userId, name: 'Credit card', icon: '💳', color: 'violet' }).returning();
    const file = { ...fixture, version: 2, accounts: [
      { ...fixture.accounts[0], id: 'a1', name: 'Card', type: 'credit' },       // legacy key -> existing "Credit card"
      { ...fixture.accounts[0], id: 'a2', name: 'Broker', type: 'Investments' }, // unknown name -> new type
      { ...fixture.accounts[0], id: 'a3', name: 'Main', type: 'bank' },          // legacy key -> new "Bank"
    ], transactions: [], budgets: [] };
    expect(previewImport(file).errors).toEqual([]);
    await commitImport(file, userId);

    const types = await db.select().from(accountTypes).where(eq(accountTypes.userId, userId));
    expect(types.map((t) => t.name).sort()).toEqual(['Bank', 'Credit card', 'Investments']);
    const accs = await db.select().from(accounts).where(eq(accounts.userId, userId));
    const typeName = (accName: string) => types.find((t) => t.id === accs.find((a) => a.name === accName)!.accountTypeId)!.name;
    expect(accs.find((a) => a.name === 'Card')!.accountTypeId).toBe(mine.id);
    expect(typeName('Broker')).toBe('Investments');
    expect(typeName('Main')).toBe('Bank');
  });

  it('maps old "travel" accounts to Travel card and keeps old "grant" accounts under a Grant type', async () => {
    const [user] = await db.insert(users).values({ email: 'importer-legacy-types@example.com', passwordHash: 'x' }).returning();
    userId = user.id;
    const file = { ...fixture, version: 1, accounts: [
      { ...fixture.accounts[0], id: 't1', name: 'Wise', type: 'travel' },
      { ...fixture.accounts[0], id: 'g1', name: 'Scholarship', type: 'grant' },
    ], transactions: [], budgets: [] };
    await commitImport(file, userId);
    const types = await db.select().from(accountTypes).where(eq(accountTypes.userId, userId));
    expect(types.map((t) => t.name).sort()).toEqual(['Grant', 'Travel card']);
    expect(types.find((t) => t.name === 'Grant')).toMatchObject({ icon: '🎓', color: 'teal' });
  });

  it('flags a loan without a person or kind', () => {
    const base = { ...fixture.transactions[0], type: 'loan', categoryId: null };
    expect(previewImport({ ...fixture, transactions: [{ ...base, loanKind: 'lend' }] }).errors.some((e) => e.includes('person'))).toBe(true);
    expect(previewImport({ ...fixture, transactions: [{ ...base, counterparty: 'Alice' }] }).errors.some((e) => e.includes('kind'))).toBe(true);
    expect(previewImport({ ...fixture, transactions: [{ ...base, loanKind: 'lend', counterparty: 'Alice' }] }).errors).toEqual([]);
  });

  it('flags an invalid loan closed date', () => {
    const base = { ...fixture.transactions[0], type: 'loan', categoryId: null, loanKind: 'lend', counterparty: 'Alice' };
    expect(previewImport({ ...fixture, transactions: [{ ...base, loanClosedAt: 'not a date' }] }).errors.length).toBeGreaterThan(0);
  });

  it('gives imported transactions time-ordered ids in their original creation order', async () => {
    const [user] = await db.insert(users).values({ email: 'importer-order@example.com', passwordHash: 'x' }).returning();
    userId = user.id;
    const base = fixture.transactions[0];
    const file = { ...fixture, transactions: [
      { ...base, id: 'later', details: 'Added later', createdAt: '2026-09-01T10:00:00.000Z' },
      { ...base, id: 'earlier', details: 'Added earlier', createdAt: '2026-09-01T08:00:00.000Z' },
    ], budgets: [] };
    await commitImport(file, userId);
    const rows = await db.select().from(transactions).where(eq(transactions.userId, userId));
    const byId = [...rows].sort((a, b) => (a.id < b.id ? -1 : 1)).map((t) => t.details);
    expect(byId).toEqual(['Added earlier', 'Added later']);
  });

  it('treats an account without an "archived" field as not archived (older backups omit it)', async () => {
    const [user] = await db.insert(users).values({ email: 'importer-no-archived@example.com', passwordHash: 'x' }).returning();
    userId = user.id;
    const withoutArchived: Record<string, unknown> = { ...fixture.accounts[0] };
    delete withoutArchived.archived;
    const file = { ...fixture, accounts: [withoutArchived, fixture.accounts[1]] };
    expect(previewImport(file).errors).toEqual([]);
    await commitImport(file, userId);
    const accs = await db.select().from(accounts).where(eq(accounts.userId, userId));
    expect(accs.find((a) => a.name === 'Checking')!.archived).toBe(false);
  });

  it('imports an expense paid by a person (no account) and flags one with neither account nor person', () => {
    const base = { ...fixture.transactions[0], fromAccountId: null };
    expect(previewImport({ ...fixture, transactions: [{ ...base, counterparty: 'Pimpim' }] }).errors).toEqual([]);
    expect(previewImport({ ...fixture, transactions: [base] }).errors.some((e) => e.includes('account or person'))).toBe(true);
  });
});
