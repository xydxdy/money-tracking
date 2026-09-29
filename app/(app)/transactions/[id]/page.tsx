import { getTransaction } from '@/app/actions/transactions';
import { listAccounts } from '@/app/actions/accounts';
import { listCategories } from '@/app/actions/categories';
import { TransactionForm } from '@/components/transaction-form';
import { notFound } from 'next/navigation';

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [accounts, categories] = await Promise.all([listAccounts(), listCategories()]);
  let txn;
  try {
    txn = await getTransaction(id);
  } catch {
    notFound();
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit Transaction</h1>
      <TransactionForm accounts={accounts} categories={categories} existing={txn} />
    </div>
  );
}
