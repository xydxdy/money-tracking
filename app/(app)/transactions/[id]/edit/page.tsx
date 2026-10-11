import { notFound } from 'next/navigation';
import { getTransaction } from '@/app/actions/transactions';
import { listAccounts } from '@/app/actions/accounts';
import { listCategories } from '@/app/actions/categories';
import { listLoanSummary } from '@/app/actions/loans';
import { TransactionForm } from '@/components/transaction-form';
import { PageHeader } from '@/components/page-header';

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [accounts, categories, loans] = await Promise.all([listAccounts(), listCategories(), listLoanSummary()]);
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
      <TransactionForm accounts={accounts} categories={categories} existing={txn} people={people} />
    </div>
  );
}
