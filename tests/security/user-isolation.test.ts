import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, categories, transactions, budgets } from '@/db/schema';
import { eq } from 'drizzle-orm';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { createAccount, updateAccount, listAccounts, setAccountArchived, getAccountWithBalance } from '@/app/actions/accounts';
import { updateCategory, archiveCategory, deleteCategory, listCategories } from '@/app/actions/categories';
import { createBudget, updateBudget, deleteBudget, listBudgets } from '@/app/actions/budgets';
import { setReimbursementStatus, listReimbursables } from '@/app/actions/reimbursements';
import { exportUserData } from '@/lib/export';
import { createTransaction, listTransactions, updateTransaction, deleteTransaction, getTransaction } from '@/app/actions/transactions';
import { getUserAccount, getUserTransaction } from '@/lib/authorization';

let userA: { id: string; email: string }, userB: { id: string; email: string };
let accountA: { id: string }, categoryA: { id: string };
let transactionA: { id: string };
let budgetA: { id: string };
let accountB: { id: string };

function actAs(user: { id: string; email: string }) {
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: user.id, email: user.email, name: null });
}

beforeAll(async () => {
  [userA] = await db.insert(users).values({ email: 'iso-a@example.com', passwordHash: 'x' }).returning();
  [userB] = await db.insert(users).values({ email: 'iso-b@example.com', passwordHash: 'x' }).returning();
  [accountA] = await db.insert(accounts).values({ userId: userA.id, name: 'A', currency: 'USD', startingBalance: '0' }).returning();
  [categoryA] = await db.insert(categories).values({ userId: userA.id, name: 'Food', type: 'expense' }).returning();

  actAs(userA);
  transactionA = await createTransaction({
    details: 'Private', type: 'expense', payDate: '2026-09-01', fromAccountId: accountA.id, categoryId: categoryA.id, amount: '5.00', currency: 'USD',
    reimbursable: true,
  });
  [budgetA] = await db.insert(budgets).values({ userId: userA.id, month: '2026-09', categoryId: categoryA.id, currency: 'USD', plannedAmount: '100.00' }).returning();
  [accountB] = await db.insert(accounts).values({ userId: userB.id, name: 'B', currency: 'USD', startingBalance: '0' }).returning();
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(budgets);
  await db.delete(categories);
  await db.delete(accounts);
  await db.delete(users);
});

describe('user isolation', () => {
  it('User B cannot read User A accounts via listAccounts', async () => {
    actAs(userB);
    const list = await listAccounts();
    expect(list.find((a) => a.id === accountA.id)).toBeUndefined();
  });

  it('User B cannot read User A accounts by id', async () => {
    const found = await getUserAccount(accountA.id, userB.id);
    expect(found).toBeNull();
  });

  it('User B cannot modify User A accounts', async () => {
    actAs(userB);
    await expect(updateAccount(accountA.id, { name: 'Hijacked' })).rejects.toThrow('NOT_FOUND');
  });

  it('User B cannot read User A transactions', async () => {
    actAs(userB);
    const list = await listTransactions();
    expect(list.find((t) => t.id === transactionA.id)).toBeUndefined();
    expect(await getUserTransaction(transactionA.id, userB.id)).toBeNull();
  });

  it('User B cannot reference User A account/category when creating a transaction', async () => {
    actAs(userB);
    await expect(createTransaction({
      details: 'Attack', type: 'expense', payDate: '2026-09-01', fromAccountId: accountA.id, categoryId: categoryA.id, amount: '5.00', currency: 'USD',
    })).rejects.toThrow('FORBIDDEN');
  });

  it('User B cannot archive or read the balance of User A accounts', async () => {
    actAs(userB);
    await expect(setAccountArchived(accountA.id, true)).rejects.toThrow('NOT_FOUND');
    await expect(getAccountWithBalance(accountA.id)).rejects.toThrow('NOT_FOUND');
  });

  it('User B cannot read, update or delete User A transactions by id', async () => {
    actAs(userB);
    await expect(getTransaction(transactionA.id)).rejects.toThrow('NOT_FOUND');
    await expect(updateTransaction(transactionA.id, { details: 'Hijacked' })).rejects.toThrow('NOT_FOUND');
    await expect(deleteTransaction(transactionA.id)).rejects.toThrow('NOT_FOUND');
  });

  it('User B cannot point their own transaction at User A account via update', async () => {
    actAs(userB);
    const own = await createTransaction({
      details: 'Mine', type: 'expense', payDate: '2026-09-01', fromAccountId: accountB.id, amount: '1.00', currency: 'USD',
    });
    await expect(updateTransaction(own.id, { fromAccountId: accountA.id })).rejects.toThrow('FORBIDDEN');
  });

  it('User B cannot see, update, archive or delete User A categories', async () => {
    actAs(userB);
    expect((await listCategories()).find((c) => c.id === categoryA.id)).toBeUndefined();
    await expect(updateCategory(categoryA.id, { name: 'Hijacked' })).rejects.toThrow('NOT_FOUND');
    await expect(archiveCategory(categoryA.id)).rejects.toThrow('NOT_FOUND');
    await expect(deleteCategory(categoryA.id)).rejects.toThrow('NOT_FOUND');
  });

  it('User B cannot see, update or delete User A budgets, nor budget against User A category', async () => {
    actAs(userB);
    expect((await listBudgets('2026-09')).find((b) => b.id === budgetA.id)).toBeUndefined();
    await expect(updateBudget(budgetA.id, { plannedAmount: '1.00' })).rejects.toThrow('NOT_FOUND');
    await expect(deleteBudget(budgetA.id)).rejects.toThrow('NOT_FOUND');
    await expect(createBudget({ month: '2026-10', categoryId: categoryA.id, currency: 'USD', plannedAmount: '5.00' })).rejects.toThrow('FORBIDDEN');
  });

  it('User B cannot see or change User A reimbursements', async () => {
    actAs(userB);
    expect((await listReimbursables()).find((t) => t.id === transactionA.id)).toBeUndefined();
    await expect(setReimbursementStatus(transactionA.id, 'claimed')).rejects.toThrow('NOT_FOUND');
  });

  it('a userId smuggled into action input is ignored in favour of the session user', async () => {
    actAs(userB);
    const created = await createAccount({ name: 'Sneaky', currency: 'USD', startingBalance: '0', userId: userA.id } as Parameters<typeof createAccount>[0]);
    expect(created.userId).toBe(userB.id);
  });

  it("User B's export contains none of User A's data", async () => {
    const backup = await exportUserData(userB.id);
    expect(backup.accounts.some((a) => a.id === accountA.id)).toBe(false);
    expect(backup.transactions.some((t) => t.id === transactionA.id)).toBe(false);
    expect(backup.categories.some((c) => c.id === categoryA.id)).toBe(false);
    expect(backup.budgets.some((b) => b.id === budgetA.id)).toBe(false);
  });

  it("User A's data is untouched after every attack above", async () => {
    const [acc] = await db.select().from(accounts).where(eq(accounts.id, accountA.id));
    const [cat] = await db.select().from(categories).where(eq(categories.id, categoryA.id));
    const [txn] = await db.select().from(transactions).where(eq(transactions.id, transactionA.id));
    const [bud] = await db.select().from(budgets).where(eq(budgets.id, budgetA.id));
    expect(acc).toMatchObject({ name: 'A', archived: false, userId: userA.id });
    expect(cat).toMatchObject({ name: 'Food', archived: false, userId: userA.id });
    expect(txn).toMatchObject({ details: 'Private', userId: userA.id, reimbursementStatus: null });
    expect(bud).toMatchObject({ plannedAmount: '100.00', userId: userA.id });
  });
});
