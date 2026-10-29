import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import { notFound } from 'next/navigation';
import { and, or, eq, desc } from 'drizzle-orm';
import { getAccountWithBalance, setAccountArchived, listAccounts } from '@/app/actions/accounts';
import { listCategories } from '@/app/actions/categories';
import { listAccountTypes } from '@/app/actions/account-types';
import { listAccountGroups } from '@/app/actions/account-groups';
import { ConfirmButton } from '@/components/confirm-button';
import { EditAccountDialog } from '@/components/create-dialogs';
import { AccountAvatar } from '@/components/account-avatar';
import { FavoriteToggle } from '@/components/favorite-toggle';
import { TransactionRow } from '@/components/transaction-row';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/money';
import { accountColorClasses } from '@/lib/account-appearance';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { getCurrentUser } from '@/lib/session';

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();

  let account, balance;
  try {
    ({ account, balance } = await getAccountWithBalance(id));
  } catch {
    notFound();
  }

  const [history, accounts, categories, types, groups] = await Promise.all([
    db.select().from(transactions)
      .where(and(eq(transactions.userId, user.id), or(eq(transactions.fromAccountId, id), eq(transactions.toAccountId, id))))
      .orderBy(desc(transactions.payDate), desc(transactions.createdAt), desc(transactions.id)),
    listAccounts(),
    listCategories(),
    listAccountTypes(),
    listAccountGroups(),
  ]);
  const typeName = types.find((t) => t.id === account.accountTypeId)?.name ?? 'No type';
  const groupName = groups.find((g) => g.id === account.groupId)?.name;

  return (
    <>
      <Link href="/accounts" className="text-sm text-muted-foreground hover:underline">← Accounts</Link>
      <section className="relative overflow-hidden rounded-xl border bg-card p-5 shadow-xs">
        <span aria-hidden className={`absolute inset-x-0 top-0 h-1.5 ${accountColorClasses(account.color).bar}`} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <AccountAvatar icon={account.icon} color={account.color} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
                {!account.archived && <FavoriteToggle accountId={account.id} accountName={account.name} favorite={account.favorite} size="md" />}
                {account.archived && <Badge variant="secondary">Archived</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{[groupName, typeName, account.currency, account.note].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!account.archived && (
              <Button render={<Link href={`/transactions/new?account=${id}`} />} nativeButton={false}><PlusIcon /> Add transaction</Button>
            )}
            <EditAccountDialog account={account} types={types} groups={groups} />
            <ConfirmButton
              variant="outline"
              label={account.archived ? 'Unarchive' : 'Archive'}
              confirmLabel={account.archived ? 'Unarchive' : 'Archive'}
              description={account.archived
                ? `Unarchive "${account.name}"? It will appear in account pickers again.`
                : `Archive "${account.name}"? Its history and balance are kept, but it is hidden from new transactions.`}
              onConfirm={async () => { 'use server'; await setAccountArchived(id, !account.archived); }}
            />
          </div>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">Current balance</p>
        <p className={`text-3xl font-semibold tracking-tight tabular-nums ${balance.cents < 0 ? 'text-destructive' : ''}`}>
          {formatMoney(balance.cents, account.currency)}
        </p>
      </section>

      <section className="rounded-xl border bg-card shadow-xs">
        <div className="border-b px-4 py-3">
          <h2 className="font-medium">History <span className="text-sm font-normal text-muted-foreground">({history.length})</span></h2>
        </div>
        <div className="divide-y">
          {history.map((t) => <TransactionRow key={t.id} t={t} accounts={accounts} categories={categories} signFor={id} />)}
          {history.length === 0 && <p className="p-4 text-sm text-muted-foreground">No transactions yet.</p>}
        </div>
      </section>
    </>
  );
}
