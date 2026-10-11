import { WalletIcon } from 'lucide-react';
import { listAccounts } from '@/app/actions/accounts';
import { listAccountTypes } from '@/app/actions/account-types';
import { getCurrentUser } from '@/lib/session';
import { calculateAccountOverview } from '@/lib/account-stats';
import { formatMoney } from '@/lib/money';
import { SortableAccountGrid, AccountCardStatic, type AccountCard } from '@/components/sortable-account-grid';
import { CreateAccountDialog } from '@/components/create-dialogs';
import { PageHeader } from '@/components/page-header';

export default async function AccountsPage() {
  const user = await getCurrentUser();
  const month = new Date().toISOString().slice(0, 7);
  const [accounts, types, overview] = await Promise.all([listAccounts(), listAccountTypes(), calculateAccountOverview(user.id, month)]);

  const toCard = (a: (typeof accounts)[number]): AccountCard => {
    const type = types.find((t) => t.id === a.accountTypeId);
    const { balanceCents, monthChangeCents } = overview.byAccount[a.id] ?? { balanceCents: 0, monthChangeCents: 0 };
    return {
      id: a.id, name: a.name, type: type?.name ?? 'No type', typeIcon: type?.icon ?? null, currency: a.currency,
      archived: a.archived, color: a.color, icon: a.icon, negative: balanceCents < 0,
      balanceLabel: formatMoney(balanceCents, a.currency),
      monthChangeCents,
      monthChangeLabel: `${monthChangeCents > 0 ? '+' : ''}${formatMoney(monthChangeCents, a.currency)}`,
    };
  };
  const active = accounts.filter((a) => !a.archived).map(toCard);
  const archived = accounts.filter((a) => a.archived).map(toCard);

  return (
    <>
      <PageHeader
        title="Accounts"
        description={`${active.length} active ${active.length === 1 ? 'account' : 'accounts'}${archived.length ? ` · ${archived.length} archived` : ''}`}
        actions={<CreateAccountDialog types={types} />}
      />

      {overview.byCurrency.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {overview.byCurrency.map((c) => (
            <section key={c.currency} className="rounded-xl border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Total · {c.currency}</p>
                <span className="text-xs text-muted-foreground">{c.count} {c.count === 1 ? 'account' : 'accounts'}</span>
              </div>
              <p className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums break-words ${c.netCents < 0 ? 'text-destructive' : ''}`}>
                {formatMoney(c.netCents, c.currency)}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">You have</dt>
                  <dd className="font-medium tabular-nums text-positive">{formatMoney(c.assetsCents, c.currency)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">You owe</dt>
                  <dd className={`font-medium tabular-nums ${c.liabilitiesCents < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {formatMoney(Math.abs(c.liabilitiesCents), c.currency)}
                  </dd>
                </div>
              </dl>
            </section>
          ))}
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          <WalletIcon className="mx-auto mb-2 size-6" />
          No accounts yet. Use “New account” to add your first one.
        </div>
      ) : (
        <section className="space-y-2">
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Active</h2>
          {active.length > 0
            ? <SortableAccountGrid accounts={active} />
            : <p className="text-sm text-muted-foreground">All your accounts are archived.</p>}
        </section>
      )}

      {archived.length > 0 && (
        <details className="group space-y-2">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium tracking-wide text-muted-foreground uppercase [&::-webkit-details-marker]:hidden">
            <span className="transition-transform group-open:rotate-90">›</span> Archived ({archived.length})
          </summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((a) => <AccountCardStatic key={a.id} account={a} />)}
          </div>
        </details>
      )}
    </>
  );
}
