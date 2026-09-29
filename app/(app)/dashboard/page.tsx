import { getDashboardData } from '@/lib/dashboard-queries';
import { getCurrentUser } from '@/lib/session';
import { listCategories } from '@/app/actions/categories';
import { listTransactions } from '@/app/actions/transactions';
import { formatMoney } from '@/lib/money';
import { TrendChart, SpendingPie } from '@/components/dashboard-charts';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month = currentMonth() } = await searchParams;
  const user = await getCurrentUser();
  const [data, categories, recent] = await Promise.all([
    getDashboardData(user.id, month),
    listCategories(),
    listTransactions(),
  ]);
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Unknown';
  // monthlyIncomeCents/monthlyExpenseCents/reimbursableCents are single currency-blind totals
  // (per the locked-in getDashboardData interface/test), unlike balancesByCurrency which is a
  // real per-currency breakdown. Label them with the user's dominant account currency rather
  // than hardcoding 'USD', so a non-USD user doesn't see a mislabeled currency symbol.
  const primaryCurrency = Object.keys(data.balancesByCurrency)[0] ?? 'USD';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard — {month}</h1>
        <div className="flex gap-2 text-sm">
          <Link href={`/dashboard?month=${previousMonth(month)}`} className="underline">← Prev</Link>
          <Link href={`/dashboard?month=${nextMonth(month)}`} className="underline">Next →</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(data.balancesByCurrency).map(([currency, cents]) => (
          <div key={currency} className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Total balance ({currency})</p>
            <p className="text-2xl font-semibold">{formatMoney(cents, currency)}</p>
          </div>
        ))}
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Income this month</p>
          <p className="text-2xl font-semibold text-emerald-600">{formatMoney(data.monthlyIncomeCents, primaryCurrency)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Expenses this month</p>
          <p className="text-2xl font-semibold text-destructive">{formatMoney(data.monthlyExpenseCents, primaryCurrency)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Reimbursable</p>
          <p className="text-2xl font-semibold">{formatMoney(data.reimbursableCents, primaryCurrency)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">Income vs Expense (6 months)</h2>
          <TrendChart data={data.trend} />
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">Spending by Category</h2>
          {data.spendingByCategory.length > 0
            ? <SpendingPie data={data.spendingByCategory.map((s) => ({ name: categoryName(s.categoryId), cents: s.cents }))} />
            : <p className="text-sm text-muted-foreground">No expenses recorded this month.</p>}
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="mb-3 font-medium">Budget summary</h2>
        {data.budgetProgress.length > 0 ? (
          <div className="space-y-3">
            {data.budgetProgress.map(({ budget, category, plannedCents, spentCents, remainingCents, percentUsed }) => (
              <div key={budget.id}>
                <div className="flex items-center justify-between text-sm">
                  <span>{category.icon} {category.name}</span>
                  <span className={percentUsed > 100 ? 'text-destructive font-medium' : ''}>
                    {formatMoney(spentCents, budget.currency)} / {formatMoney(plannedCents, budget.currency)}
                  </span>
                </div>
                <Progress value={Math.min(percentUsed, 100)} className="mt-2" />
                <p className="mt-1 text-sm text-muted-foreground">
                  Remaining: {formatMoney(remainingCents, budget.currency)} ({percentUsed.toFixed(0)}% used)
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No budgets set for this month.</p>
        )}
      </div>

      <div className="rounded-lg border">
        <h2 className="border-b p-4 font-medium">Recent transactions</h2>
        <div className="divide-y">
          {recent.slice(0, 8).map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3">
              <span>{t.details}</span>
              <span className="text-sm text-muted-foreground">{t.payDate}</span>
            </div>
          ))}
          {recent.length === 0 && <p className="p-4 text-sm text-muted-foreground">No transactions yet.</p>}
        </div>
      </div>
    </div>
  );
}

function previousMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}
function nextMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
}
