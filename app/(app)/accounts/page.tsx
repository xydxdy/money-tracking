import { WalletIcon } from 'lucide-react';
import { listAccounts } from '@/app/actions/accounts';
import { listAccountTypes } from '@/app/actions/account-types';
import { listAccountGroups } from '@/app/actions/account-groups';
import { getCurrentUser } from '@/lib/session';
import { calculateAccountOverview } from '@/lib/account-stats';
import { formatMoney } from '@/lib/money';
import { AccountBoard, ArchivedAccounts, type AccountRow } from '@/components/account-board';
import { CreateAccountDialog, CreateAccountGroupDialog } from '@/components/create-dialogs';
import { PageHeader } from '@/components/page-header';

export default async function AccountsPage() {
  const user = await getCurrentUser();
  const month = new Date().toISOString().slice(0, 7);
  const [accounts, types, groups, overview] = await Promise.all([
    listAccounts(), listAccountTypes(), listAccountGroups(), calculateAccountOverview(user.id, month),
  ]);

  const toRow = (a: (typeof accounts)[number]): AccountRow => {
    const type = types.find((t) => t.id === a.accountTypeId);
    const { balanceCents, monthChangeCents } = overview.byAccount[a.id] ?? { balanceCents: 0, monthChangeCents: 0 };
    return {
      id: a.id, name: a.name, type: type?.name ?? 'No type', typeIcon: type?.icon ?? null, currency: a.currency,
      archived: a.archived, favorite: a.favorite, color: a.color, icon: a.icon, groupId: a.groupId, balanceCents, monthChangeCents,
    };
  };
  const active = accounts.filter((a) => !a.archived).map(toRow);
  const archived = accounts.filter((a) => a.archived).map(toRow);

  const summary = [
    `${active.length} active ${active.length === 1 ? 'account' : 'accounts'}`,
    groups.length > 0 && `${groups.length} ${groups.length === 1 ? 'group' : 'groups'}`,
    archived.length > 0 && `${archived.length} archived`,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <PageHeader
        title="Accounts"
        description={summary}
        actions={<><CreateAccountGroupDialog /><CreateAccountDialog types={types} groups={groups} /></>}
      />

      {overview.byCurrency.length > 0 && (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 xl:grid-cols-4">
          {overview.byCurrency.map((c) => (
            <section key={c.currency} className="min-w-60 shrink-0 snap-start rounded-xl border bg-card p-4 shadow-xs sm:min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">Net worth · {c.currency}</p>
                <span className="text-xs text-muted-foreground">{c.count} {c.count === 1 ? 'account' : 'accounts'}</span>
              </div>
              <p className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums break-words ${c.netCents < 0 ? 'text-destructive' : ''}`}>
                {formatMoney(c.netCents, c.currency)}
              </p>
              <dl className="mt-2 flex gap-4 text-xs">
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">Have</dt>
                  <dd className="font-medium tabular-nums text-positive">{formatMoney(c.assetsCents, c.currency)}</dd>
                </div>
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">Owe</dt>
                  <dd className={`font-medium tabular-nums ${c.liabilitiesCents < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {formatMoney(Math.abs(c.liabilitiesCents), c.currency)}
                  </dd>
                </div>
              </dl>
            </section>
          ))}
        </div>
      )}

      {accounts.length === 0 && groups.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          <WalletIcon className="mx-auto mb-2 size-6" />
          No accounts yet. Use “New account” to add your first one, or “New group” to set up a bank that holds several accounts.
        </div>
      ) : active.length === 0 && groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">All your accounts are archived.</p>
      ) : (
        <AccountBoard accounts={active} groups={groups} types={types} />
      )}

      {archived.length > 0 && <ArchivedAccounts accounts={archived} groups={groups} />}
    </>
  );
}
