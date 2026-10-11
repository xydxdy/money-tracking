import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts, transactions } from '@/db/schema';
import { addCents, toCents } from '@/lib/money';
import { accountDelta } from '@/lib/balances';
import { monthRange } from '@/lib/dates';

export type CurrencyOverview = { currency: string; count: number; assetsCents: number; liabilitiesCents: number; netCents: number };

/**
 * Every account's balance and its net change in `month`, from one pass over the user's
 * transactions; plus, per currency, the active accounts' totals split into what you have
 * (positive balances) and what you owe (negative ones). Currencies follow the account order.
 */
export async function calculateAccountOverview(userId: string, month: string) {
  const [userAccounts, rows] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, userId))
      .orderBy(sql`${accounts.position} asc nulls last`, asc(accounts.currency), asc(sql`lower(${accounts.name})`)),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
  ]);
  const { from, to } = monthRange(month);

  const byAccount: Record<string, { balanceCents: number; monthChangeCents: number }> = {};
  for (const a of userAccounts) {
    let balanceCents = toCents(a.startingBalance);
    let monthChangeCents = 0;
    for (const t of rows) {
      const d = accountDelta(t, a.id);
      if (d === 0) continue;
      balanceCents = addCents(balanceCents, d);
      if (t.payDate >= from && t.payDate <= to) monthChangeCents = addCents(monthChangeCents, d);
    }
    byAccount[a.id] = { balanceCents, monthChangeCents };
  }

  const totals = new Map<string, CurrencyOverview>();
  for (const a of userAccounts.filter((x) => !x.archived)) {
    const t = totals.get(a.currency) ?? { currency: a.currency, count: 0, assetsCents: 0, liabilitiesCents: 0, netCents: 0 };
    const b = byAccount[a.id].balanceCents;
    t.count += 1;
    if (b >= 0) t.assetsCents += b;
    else t.liabilitiesCents += b;
    t.netCents += b;
    totals.set(a.currency, t);
  }
  return { byAccount, byCurrency: [...totals.values()] };
}
