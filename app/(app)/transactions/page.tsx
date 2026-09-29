import { listTransactions } from '@/app/actions/transactions';
import { formatMoney, toCents } from '@/lib/money';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function TransactionsPage() {
  const transactions = await listTransactions();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <Button render={<Link href="/transactions/new" />} nativeButton={false}>Add Transaction</Button>
      </div>
      {transactions.length === 0 ? (
        <p className="text-muted-foreground">No transactions yet. Add your first one.</p>
      ) : (
        <div className="rounded-lg border divide-y">
          {transactions.map((t) => (
            <Link key={t.id} href={`/transactions/${t.id}`} className="flex items-center justify-between p-3 hover:bg-accent/40">
              <div>
                <p className="font-medium">{t.details}</p>
                <p className="text-sm text-muted-foreground">{t.payDate} · {t.type}</p>
              </div>
              <p className={t.type === 'expense' ? 'text-destructive' : 'text-foreground'}>
                {formatMoney(toCents(t.amount) * (t.type === 'expense' ? -1 : 1), t.currency)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
