import { listAccounts } from '@/app/actions/accounts';
import { listCategories } from '@/app/actions/categories';
import { listLoanSummary } from '@/app/actions/loans';
import { TransactionForm } from '@/components/transaction-form';
import { PageHeader } from '@/components/page-header';

const TYPES = ['expense', 'income', 'transfer', 'loan'] as const;

export default async function NewTransactionPage({ searchParams }: { searchParams: Promise<{ type?: string; account?: string }> }) {
  // `?type=loan` (from the Loans page's "Add loan") opens the form on that type; anything else is ignored.
  // `?account=<id>` (from an account's page) pre-selects that account and returns there after saving.
  const { type, account } = await searchParams;
  const initialType = TYPES.find((t) => t === type) ?? 'expense';
  const [accounts, categories, loans] = await Promise.all([listAccounts(), listCategories(), listLoanSummary()]);
  const initialAccount = accounts.find((a) => a.id === account && !a.archived);
  const people = [...new Set(loans.map((l) => l.counterparty))];
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={initialType === 'loan' ? 'Add loan' : 'Add transaction'} />
      <TransactionForm accounts={accounts} categories={categories} people={people} initialType={initialType}
        initialAccountId={initialAccount?.id} returnTo={initialAccount && `/accounts/${initialAccount.id}`} />
    </div>
  );
}
