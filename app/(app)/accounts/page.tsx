import { listAccounts } from '@/app/actions/accounts';
import { calculateAccountBalance } from '@/lib/balances';
import { getCurrentUser } from '@/lib/session';
import { formatMoney } from '@/lib/money';
import Link from 'next/link';
import { AccountForm } from '@/components/account-form';
import { Badge } from '@/components/ui/badge';

export default async function AccountsPage() {
  const user = await getCurrentUser();
  const accounts = await listAccounts();
  const withBalances = await Promise.all(
    accounts.map(async (a) => ({ ...a, balance: await calculateAccountBalance(a.id, user.id) }))
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Accounts</h1>
      {withBalances.length === 0 ? (
        <p className="text-muted-foreground">No accounts yet. Create your first one below.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {withBalances.map((a) => (
            <Link key={a.id} href={`/accounts/${a.id}`} className="rounded-lg border p-4 hover:bg-accent/40">
              <div className="flex items-center justify-between">
                <span className="font-medium">{a.name}</span>
                {a.archived && <Badge variant="secondary">Archived</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{a.type} · {a.currency}</p>
              <p className="mt-2 text-lg font-semibold">{formatMoney(a.balance.cents, a.currency)}</p>
            </Link>
          ))}
        </div>
      )}
      <AccountForm />
    </div>
  );
}
