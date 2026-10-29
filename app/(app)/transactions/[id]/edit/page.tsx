import { notFound } from 'next/navigation';
import { getTransaction } from '@/app/actions/transactions';
import { listAccounts } from '@/app/actions/accounts';
import { listAccountGroups } from '@/app/actions/account-groups';
import { getCurrentUser } from '@/lib/session';
import { calculateAccountOverview } from '@/lib/account-stats';
import { listCategories } from '@/app/actions/categories';
import { listLoanSummary } from '@/app/actions/loans';
import { TransactionForm } from '@/components/transaction-form';
import { PageHeader } from '@/components/page-header';

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const [accounts, groups, categories, loans, overview] = await Promise.all([
    listAccounts(), listAccountGroups(), listCategories(), listLoanSummary(),
    calculateAccountOverview(user.id, new Date().toISOString().slice(0, 7)),
  ]);
  const balances = Object.fromEntries(Object.entries(overview.byAccount).map(([accountId, b]) => [accountId, b.balanceCents]));
  const people = [...new Set(loans.map((l) => l.counterparty))];
  let txn;
  try {
    txn = await getTransaction(id);
  } catch {
    notFound();
  }
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Edit transaction" />
      <TransactionForm accounts={accounts} groups={groups} balances={balances} categories={categories} existing={txn} people={people} />
    </div>
  );
}
