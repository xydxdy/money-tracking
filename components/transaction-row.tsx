import Link from 'next/link';
import { HandCoinsIcon } from 'lucide-react';
import { TransactionIcon } from '@/components/transaction-icon';
import { formatMoney, toCents } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import type { Account, Category, Transaction } from '@/db/schema';

type Row = Pick<Transaction, 'id' | 'details' | 'type' | 'payDate' | 'amount' | 'currency' | 'fromAccountId' | 'toAccountId' | 'categoryId' | 'loanKind' | 'counterparty'>;

export const LOAN_LABELS = {
  lend: 'Lent to', borrow: 'Borrowed from', repayment_in: 'Repaid by', repayment_out: 'Repaid to',
} as const;

/** Labels without the name, for lists that are already about one person (their loan history). */
const LOAN_LABELS_SHORT = {
  lend: 'Lent', borrow: 'Borrowed', repayment_in: 'They repaid', repayment_out: 'You repaid',
} as const;

/**
 * One transaction in a list: account tile, details, category · account · date, signed amount.
 * The row opens the read-only view (which has the Edit button).
 * `signFor` lets an account page show money leaving that account as negative.
 */
export function TransactionRow({ t, accounts, categories, signFor, showDate = true, tag, muted = false, personContext = false }: {
  t: Row; accounts: Account[]; categories: Category[]; signFor?: string; showDate?: boolean;
  /** The list is already about one person (loan history): leave their name out of the label. */
  personContext?: boolean;
  /** Small label after the details, e.g. "Closed". */
  tag?: string;
  muted?: boolean;
}) {
  const from = accounts.find((a) => a.id === t.fromAccountId);
  const to = accounts.find((a) => a.id === t.toAccountId);
  const moneyIn = t.type === 'income' || t.loanKind === 'borrow' || t.loanKind === 'repayment_in';
  const account = moneyIn ? to : from;
  const category = categories.find((c) => c.id === t.categoryId);
  const cents = toCents(t.amount);
  const signed = signFor
    ? (t.fromAccountId === signFor ? -cents : cents)
    : t.type === 'expense' || (t.type === 'loan' && !moneyIn) ? -cents : cents;
  const tone = t.type === 'transfer' && !signFor ? 'text-foreground' : signed < 0 ? 'text-destructive' : 'text-positive';
  const name = t.counterparty ?? '?';
  const person = t.type === 'loan' && t.loanKind
    ? (personContext ? LOAN_LABELS_SHORT[t.loanKind] : `${LOAN_LABELS[t.loanKind]} ${name}`)
    : t.type === 'expense' && !t.fromAccountId && t.counterparty ? (personContext ? 'Paid for you' : `Paid by ${name}`)
    : t.type === 'income' && !t.toAccountId && t.counterparty ? (personContext ? 'Received by them' : `Received by ${name}`) : null;
  // Plain-text details after the (optional) person label; joined so the line truncates with "…".
  const details = [
    category?.name,
    t.type === 'transfer' ? `${from?.name ?? '?'} → ${to?.name ?? '?'}` : account?.name,
    showDate ? formatDate(t.payDate) : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className={`transition-colors hover:bg-accent/50 ${muted ? 'opacity-60' : ''}`}>
      <Link href={`/transactions/${t.id}`} className="flex min-w-0 items-center gap-3 px-3 py-3 sm:px-4">
        <TransactionIcon categoryIcon={category?.icon ?? null} type={t.type} viaPerson={!!person} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-medium">
            <span className="truncate">{t.details}</span>
            {tag && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">{tag}</span>}
          </p>
          <p className="flex min-w-0 items-center gap-1 text-sm whitespace-nowrap text-muted-foreground">
            {person && (
              <span className="inline-flex shrink-0 items-center gap-1 text-amber-700 dark:text-amber-300">
                <HandCoinsIcon aria-hidden className="size-3.5" />{person}
              </span>
            )}
            {person && details && <span aria-hidden className="shrink-0">·</span>}
            {details && <span className="min-w-0 truncate">{details}</span>}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-medium whitespace-nowrap tabular-nums ${tone}`}>
            {signed > 0 && t.type !== 'transfer' ? '+' : ''}{formatMoney(signed, t.currency)}
          </p>
          <p className="text-xs text-muted-foreground capitalize">{t.type}</p>
        </div>
      </Link>
    </div>
  );
}
