import { db } from '@/db/client';
import { accounts, transactions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { toCents, addCents } from '@/lib/money';

type Movement = { type: string; amount: string; toAmount: string | null; loanKind: string | null; fromAccountId: string | null; toAccountId: string | null };

/**
 * How much one transaction moves one account's balance, in cents: income and money arriving add,
 * expenses and money leaving subtract. Transfers credit the destination with `toAmount` when the
 * currencies differ. Lending or paying back takes money out; borrowing or being paid back brings
 * it in. Expenses paid by / income received by a person have no account and move nothing.
 */
export function accountDelta(t: Movement, accountId: string): number {
  let cents = 0;
  if (t.type === 'income' && t.toAccountId === accountId) {
    cents = toCents(t.amount);
  } else if (t.type === 'expense' && t.fromAccountId === accountId) {
    cents = -toCents(t.amount);
  } else if (t.type === 'transfer') {
    if (t.fromAccountId === accountId) cents = addCents(cents, -toCents(t.amount));
    if (t.toAccountId === accountId) cents = addCents(cents, toCents(t.toAmount ?? t.amount));
  } else if (t.type === 'loan') {
    const out = t.loanKind === 'lend' || t.loanKind === 'repayment_out';
    if (out && t.fromAccountId === accountId) cents = -toCents(t.amount);
    if (!out && t.toAccountId === accountId) cents = toCents(t.amount);
  }
  return cents;
}

export async function calculateAccountBalance(accountId: string, userId: string) {
  const [account] = await db.select().from(accounts).where(and(eq(accounts.id, accountId), eq(accounts.userId, userId))).limit(1);
  if (!account) throw new Error('Account not found');

  const rows = await db.select().from(transactions).where(eq(transactions.userId, userId));

  let cents = toCents(account.startingBalance);
  for (const t of rows) cents = addCents(cents, accountDelta(t, accountId));

  return { cents, currency: account.currency };
}
