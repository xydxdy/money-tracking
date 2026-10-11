import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLinkIcon, PencilIcon, HandCoinsIcon } from 'lucide-react';
import { IconLabel } from '@/components/app-icon';
import { getTransaction, deleteTransaction } from '@/app/actions/transactions';
import { listAccounts } from '@/app/actions/accounts';
import { listCategories } from '@/app/actions/categories';
import { formatMoney, toCents } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { safeHref } from '@/lib/link';
import { REIMBURSEMENT_LABELS } from '@/lib/reimbursements';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmButton } from '@/components/confirm-button';
import { TransactionIcon } from '@/components/transaction-icon';
import { LOAN_LABELS } from '@/components/transaction-row';


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let txn;
  try {
    txn = await getTransaction(id);
  } catch {
    notFound();
  }
  const [accounts, categories] = await Promise.all([listAccounts(), listCategories()]);
  const accountName = (accountId: string | null) => {
    const a = accounts.find((x) => x.id === accountId);
    return a ? `${a.name} (${a.currency})` : '—';
  };
  const category = categories.find((c) => c.id === txn.categoryId);
  const toCurrency = accounts.find((a) => a.id === txn.toAccountId)?.currency;
  const href = safeHref(txn.link);
  const txnId = txn.id;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/transactions" className="text-sm text-muted-foreground hover:underline">← Transactions</Link>
          <div className="mt-2 flex items-center gap-3">
            <TransactionIcon categoryIcon={category?.icon ?? null} type={txn.type} viaPerson={!!txn.counterparty} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{txn.details}</h1>
              <p className="text-muted-foreground capitalize">{formatDate(txn.payDate)} · {txn.type}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button render={<Link href={`/transactions/${txn.id}/edit`} />} nativeButton={false}>
            <PencilIcon /> Edit
          </Button>
          <ConfirmButton
            label="Delete"
            description={`Delete "${txn.details}"? This cannot be undone.`}
            confirmText={txn.details}
            redirectTo="/transactions"
            onConfirm={async () => { 'use server'; await deleteTransaction(txnId); }}
          />
        </div>
      </div>

      <dl className="divide-y rounded-xl border bg-card px-4 shadow-xs">
        <Field label="Amount">
          <span className={`text-base font-semibold tabular-nums ${txn.type === 'expense' ? 'text-destructive' : txn.type === 'income' ? 'text-positive' : txn.type === 'loan' ? 'text-amber-600 dark:text-amber-400' : ''}`}>{formatMoney(toCents(txn.amount), txn.currency)}</span>
          {txn.toAmount && toCurrency && <span className="text-muted-foreground"> → {formatMoney(toCents(txn.toAmount), toCurrency)} received</span>}
        </Field>
        {txn.type !== 'loan' && txn.counterparty && (
          <Field label={txn.type === 'expense' ? 'Paid by' : 'Received by'}>
            <HandCoinsIcon className="mr-1 inline size-4 text-amber-600 dark:text-amber-400" /><span className="font-medium">{txn.counterparty}</span>{' '}
            <Link href="/loans" className="text-primary hover:underline">· see balance</Link>
            {txn.loanClosedAt && <Badge variant="secondary" className="ml-2">Closed {formatDate(txn.loanClosedAt.toISOString().slice(0, 10))}</Badge>}
          </Field>
        )}
        {txn.fromAccountId && <Field label="From account">{accountName(txn.fromAccountId)}</Field>}
        {txn.toAccountId && <Field label="To account">{accountName(txn.toAccountId)}</Field>}
        {txn.type === 'loan' && txn.loanKind && (
          <Field label="Loan"><HandCoinsIcon className="mr-1 inline size-4 text-amber-600 dark:text-amber-400" />{LOAN_LABELS[txn.loanKind]} <span className="font-medium">{txn.counterparty}</span>{' '}
            <Link href={`/loans`} className="text-primary hover:underline">· see balance</Link>
            {txn.loanClosedAt && <Badge variant="secondary" className="ml-2">Closed {formatDate(txn.loanClosedAt.toISOString().slice(0, 10))}</Badge>}</Field>
        )}
        {txn.type !== 'loan' && <Field label="Category">{category ? <IconLabel icon={category.icon}>{category.name}</IconLabel> : '—'}</Field>}
        {txn.type !== 'loan' && <Field label="Reimbursable">
          {txn.reimbursable
            ? <Badge variant="secondary">{REIMBURSEMENT_LABELS[txn.reimbursementStatus ?? 'to_claim']}</Badge>
            : 'No'}
        </Field>}
        <Field label="Link">
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
              <span className="break-all">{href}</span> <ExternalLinkIcon className="size-3.5 shrink-0" />
            </a>
          ) : '—'}
        </Field>
        <Field label="Note">{txn.note || '—'}</Field>
      </dl>
    </div>
  );
}
