import Link from 'next/link';
import { HandCoinsIcon } from 'lucide-react';
import { AppIcon } from '@/components/app-icon';
import { formatMoney, toCents } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import type { Account } from '@/db/schema';

type Item = { id: string; details: string; payDate: string; amount: string; currency: string; fromAccountId: string | null; counterparty: string | null };

/**
 * The transactions behind a budget (or a category without one): account (or who paid), details,
 * date and amount, plus each one's share of the budget when `plannedCents` is given.
 */
export function BudgetTransactionList({ transactions, accounts, plannedCents, viewHref }: {
  transactions: Item[];
  accounts: Pick<Account, 'id' | 'name' | 'icon' | 'color'>[];
  plannedCents?: number;
  viewHref: string;
}) {
  return (
    <div className="mt-3 ml-2 border-l pl-3 sm:ml-[2.4rem]">
      <div className="flex items-center justify-between gap-2 pb-1 text-xs text-muted-foreground">
        <span>{transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}{transactions.length > 1 ? ' · newest first' : ''}</span>
        <Link href={viewHref} className="font-medium text-primary hover:underline">
          View in Transactions
        </Link>
      </div>
      <div className="divide-y divide-border/60">
        {transactions.map((t) => {
          const account = accounts.find((a) => a.id === t.fromAccountId);
          const cents = toCents(t.amount);
          const share = plannedCents && plannedCents > 0 ? Math.round((cents / plannedCents) * 100) : null;
          return (
            <div key={t.id}>
              <Link href={`/transactions/${t.id}`} className="-mx-2 flex min-w-0 items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent/50">
                {t.counterparty && !t.fromAccountId ? (
                  <span aria-hidden className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <HandCoinsIcon className="size-3.5" />
                  </span>
                ) : (
                  // Neutral grey rather than the account's colour, so the list reads calmly.
                  <span aria-hidden className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <AppIcon icon={account?.icon} fallback="landmark" className="size-3.5" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.details}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatDate(t.payDate)} · {t.counterparty && !t.fromAccountId ? `Paid by ${t.counterparty}` : account?.name ?? '—'}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-medium whitespace-nowrap tabular-nums">{formatMoney(cents, t.currency)}</span>
                  {share !== null && <span className="block text-xs text-muted-foreground tabular-nums">{share}% of budget</span>}
                </span>
              </Link>
            </div>
          );
        })}
        {transactions.length === 0 && <p className="py-2 text-sm text-muted-foreground">No transactions yet.</p>}
      </div>
    </div>
  );
}
