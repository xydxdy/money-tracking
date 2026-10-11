import { listAccounts } from '@/app/actions/accounts';
import { listAccountTypes } from '@/app/actions/account-types';
import { calculateAccountBalance } from '@/lib/balances';
import { getCurrentUser } from '@/lib/session';
import { formatMoney } from '@/lib/money';
import { CreateAccountDialog } from '@/components/create-dialogs';
import { PageHeader } from '@/components/page-header';
import { SortableAccountGrid } from '@/components/sortable-account-grid';

export default async function AccountsPage() {
  const user = await getCurrentUser();
  const [accounts, types] = await Promise.all([listAccounts(), listAccountTypes()]);
  const withBalances = await Promise.all(
    accounts.map(async (a) => ({ ...a, balance: await calculateAccountBalance(a.id, user.id) }))
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Accounts" description="Sorted by currency and name. Drag the handle on a card to reorder." actions={<CreateAccountDialog types={types} />} />
      {withBalances.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">No accounts yet. Use “New account” to create your first one.</p>
      ) : (
        <>
          <SortableAccountGrid
            accounts={withBalances.map((a) => ({
              id: a.id, name: a.name, type: types.find((t) => t.id === a.accountTypeId)?.name ?? 'No type', currency: a.currency, archived: a.archived,
              balanceLabel: formatMoney(a.balance.cents, a.currency), color: a.color, icon: a.icon, negative: a.balance.cents < 0,
            }))}
          />
        </>
      )}
    </div>
  );
}
