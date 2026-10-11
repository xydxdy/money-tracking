import { getAccountWithBalance, setAccountArchived } from '@/app/actions/accounts';
import { ConfirmButton } from '@/components/confirm-button';
import { formatMoney, toCents } from '@/lib/money';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { and, or, eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/session';
import { notFound } from 'next/navigation';

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();

  let account, balance;
  try {
    ({ account, balance } = await getAccountWithBalance(id));
  } catch {
    notFound();
  }

  const history = await db.select().from(transactions)
    .where(and(eq(transactions.userId, user.id), or(eq(transactions.fromAccountId, id), eq(transactions.toAccountId, id))))
    .orderBy(desc(transactions.payDate));

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">{account.name}</h1>
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
        <p className="text-muted-foreground">{account.type} · {account.currency}</p>
        <p className="mt-2 text-3xl font-bold">{formatMoney(balance.cents, account.currency)}</p>
      </div>
      <div className="rounded-lg border divide-y">
        {history.map((t) => (
          <div key={t.id} className="flex items-center justify-between p-3">
            <div>
              <p className="font-medium">{t.details}</p>
              <p className="text-sm text-muted-foreground">{t.payDate} · {t.type}</p>
            </div>
            <p>{formatMoney(toCents(t.amount) * (t.fromAccountId === id ? -1 : 1), t.currency)}</p>
          </div>
        ))}
        {history.length === 0 && <p className="p-3 text-sm text-muted-foreground">No transactions yet.</p>}
      </div>
    </div>
  );
}
