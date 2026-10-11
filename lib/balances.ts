import { db } from '@/db/client';
import { accounts, transactions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { toCents, addCents } from '@/lib/money';

export async function calculateAccountBalance(accountId: string, userId: string) {
  const [account] = await db.select().from(accounts).where(and(eq(accounts.id, accountId), eq(accounts.userId, userId))).limit(1);
  if (!account) throw new Error('Account not found');

  const rows = await db.select().from(transactions).where(eq(transactions.userId, userId));

  let cents = toCents(account.startingBalance);
  for (const t of rows) {
    if (t.type === 'income' && t.toAccountId === accountId) {
      cents = addCents(cents, toCents(t.amount));
    } else if (t.type === 'expense' && t.fromAccountId === accountId) {
      cents = addCents(cents, -toCents(t.amount));
    } else if (t.type === 'transfer') {
      if (t.fromAccountId === accountId) cents = addCents(cents, -toCents(t.amount));
      if (t.toAccountId === accountId) cents = addCents(cents, toCents(t.toAmount ?? t.amount));
    } else if (t.type === 'loan') {
      // Lending or paying back takes money out; borrowing or being paid back brings it in.
      const out = t.loanKind === 'lend' || t.loanKind === 'repayment_out';
      if (out && t.fromAccountId === accountId) cents = addCents(cents, -toCents(t.amount));
      if (!out && t.toAccountId === accountId) cents = addCents(cents, toCents(t.amount));
    }
  }

  return { cents, currency: account.currency };
}
