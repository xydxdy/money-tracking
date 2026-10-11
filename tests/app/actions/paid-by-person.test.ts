import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, categories, transactions } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { createTransaction, updateTransaction } from '@/app/actions/transactions';
import { listLoanSummary, listLoanHistory, closeLoans } from '@/app/actions/loans';
import { calculateAccountBalance } from '@/lib/balances';
import { getDashboardData } from '@/lib/dashboard-queries';
import { calculateBudgetProgress } from '@/lib/budget-calc';
import { budgets } from '@/db/schema';

let user: { id: string; email: string };
let bank: { id: string }, housing: { id: string };

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'paid-by@example.com', passwordHash: 'x' }).returning();
  [bank] = await db.insert(accounts).values({ userId: user.id, name: 'Bank', currency: 'USD', startingBalance: '2000.00' }).returning();
  [housing] = await db.insert(categories).values({ userId: user.id, name: 'Housing', type: 'expense' }).returning();
  await db.insert(budgets).values({ userId: user.id, month: '2026-06', categoryId: housing.id, currency: 'USD', plannedAmount: '1000.00' });
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: user.id, email: user.email, name: null });
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(budgets);
  await db.delete(categories);
  await db.delete(accounts);
  await db.delete(users);
});

describe('expenses paid by a person', () => {
  it('records an expense paid by someone else: no account, explicit currency, category kept', async () => {
    const txn = await createTransaction({ type: 'expense', details: 'Housing', payDate: '2026-06-03', amount: '700.00', categoryId: housing.id, counterparty: 'Pimpim', currency: 'usd' });
    expect(txn).toMatchObject({ type: 'expense', fromAccountId: null, counterparty: 'Pimpim', currency: 'USD', categoryId: housing.id, loanKind: null });
  });

  it('needs either an account or a person, and a currency when paid by a person', async () => {
    const base = { type: 'expense' as const, details: 'x', payDate: '2026-06-03', amount: '1.00' };
    await expect(createTransaction(base)).rejects.toThrow();
    await expect(createTransaction({ ...base, counterparty: 'Pimpim' })).rejects.toThrow();
  });

  it('still counts as spending (dashboard and budgets) but moves no account balance', async () => {
    expect((await calculateAccountBalance(bank.id, user.id)).cents).toBe(200000);
    const data = await getDashboardData(user.id, '2026-06');
    expect(data.monthlyExpenseCents.USD).toBe(70000);
    const [progress] = await calculateBudgetProgress(user.id, '2026-06');
    expect(progress.spentCents).toBe(70000);
  });

  it('adds to what you owe that person; a refund received by them and a repayment reduce it', async () => {
    await createTransaction({ type: 'income', details: 'Refund to her card', payDate: '2026-06-11', amount: '100.00', counterparty: 'pimpim', currency: 'USD' });
    await createTransaction({ type: 'loan', loanKind: 'borrow', details: 'Into my bank', payDate: '2026-06-02', amount: '50.00', counterparty: 'Pimpim', toAccountId: bank.id });
    await createTransaction({ type: 'loan', loanKind: 'repayment_out', details: 'Paid back', payDate: '2026-06-16', amount: '600.00', counterparty: 'Pimpim', fromAccountId: bank.id });
    const [p] = await listLoanSummary();
    // owed: 700 paid for me + 50 borrowed − 100 refunded to her − 600 repaid = 50
    expect(p).toMatchObject({ counterparty: 'Pimpim', currency: 'USD', borrowedCents: 75000, repaidByMeCents: 70000, netCents: -5000, count: 4 });
    // the bank balance only moves for real money: +50 borrowed − 600 repaid
    expect((await calculateAccountBalance(bank.id, user.id)).cents).toBe(145000);
  });

  it('shows paid-by entries in the person’s history and closes them with the loans', async () => {
    const [open] = await listLoanHistory();
    expect(open.transactions.map((t) => t.details).sort()).toEqual(['Housing', 'Into my bank', 'Paid back', 'Refund to her card']);
    expect(await closeLoans({ counterparty: 'Pimpim', currency: 'USD' })).toBe(4);
    expect(await listLoanSummary()).toEqual([]);
  });

  it('switching a paid-by expense to an account clears the person', async () => {
    const txn = await createTransaction({ type: 'expense', details: 'Coffee', payDate: '2026-06-05', amount: '4.00', counterparty: 'Pimpim', currency: 'USD' });
    const updated = await updateTransaction(txn.id, { fromAccountId: bank.id });
    expect(updated).toMatchObject({ fromAccountId: bank.id, counterparty: null, loanClosedAt: null });
    const back = await updateTransaction(txn.id, { fromAccountId: null, counterparty: 'Pimpim', currency: 'USD' });
    expect(back).toMatchObject({ fromAccountId: null, counterparty: 'Pimpim' });
  });
});
