import { listAccounts } from '@/app/actions/accounts';
import { listCategories } from '@/app/actions/categories';
import { TransactionForm } from '@/components/transaction-form';

export default async function NewTransactionPage() {
  const [accounts, categories] = await Promise.all([listAccounts(), listCategories()]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Add Transaction</h1>
      <TransactionForm accounts={accounts} categories={categories} />
    </div>
  );
}
