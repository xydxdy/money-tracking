import Link from 'next/link';
import { ArrowLeftRightIcon } from 'lucide-react';
import { formatMoney, toCents } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { AccountAvatar } from '@/components/account-avatar';
import { EditTransactionLink } from '@/components/edit-transaction-link';
import type { Account, Category, Transaction } from '@/db/schema';

type Row = Pick<Transaction, 'id' | 'details' | 'type' | 'payDate' | 'amount' | 'currency' | 'fromAccountId' | 'toAccountId' | 'categoryId' | 'loanKind' | 'counterparty'>;

export const LOAN_LABELS = {
  lend: 'Lent to', borrow: 'Borrowed from', repayment_in: 'Repaid by', repayment_out: 'Repaid to',
} as const;

/**
 * One transaction in a list: account tile, details, category · account · date, signed amount.
 * The row opens the read-only view; the pencil opens the edit form.
 * `signFor` lets an account page show money leaving that account as negative.
 */
export function TransactionRow({ t, accounts, categories, signFor, showDate = true, tag, muted = false }: {
  t: Row; accounts: Account[]; categories: Category[]; signFor?: string; showDate?: boolean;
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
  const meta = [
    t.type === 'loan' && t.loanKind ? `🤝 ${LOAN_LABELS[t.loanKind]} ${t.counterparty ?? '?'}` : null,
    t.type === 'expense' && !t.fromAccountId && t.counterparty ? `🤝 Paid by ${t.counterparty}` : null,
    t.type === 'income' && !t.toAccountId && t.counterparty ? `🤝 Received by ${t.counterparty}` : null,
    category ? `${category.icon ?? ''} ${category.name}`.trim() : null,
    t.type === 'transfer' ? `${from?.name ?? '?'} → ${to?.name ?? '?'}` : account?.name,
    showDate ? formatDate(t.payDate) : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className={`flex items-center gap-1 pr-2 transition-colors hover:bg-accent/50 ${muted ? 'opacity-60' : ''}`}>
      <Link href={`/transactions/${t.id}`} className="flex min-w-0 flex-1 items-center gap-3 p-3">
        {t.type === 'transfer'
          ? <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><ArrowLeftRightIcon className="size-4" /></span>
          : <AccountAvatar icon={account?.icon} color={account?.color} />}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-medium">
            <span className="truncate">{t.details}</span>
            {tag && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">{tag}</span>}
          </p>
          <p className="truncate text-sm text-muted-foreground">{meta}</p>
        </div>
        <p className={`shrink-0 font-medium tabular-nums ${tone}`}>
          {signed > 0 && t.type !== 'transfer' ? '+' : ''}{formatMoney(signed, t.currency)}
        </p>
      </Link>
      <EditTransactionLink id={t.id} details={t.details} />
    </div>
  );
}
