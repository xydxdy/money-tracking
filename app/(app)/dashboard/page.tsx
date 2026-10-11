import Link from 'next/link';
import { ArrowDownLeftIcon, ArrowUpRightIcon, LandmarkIcon, ReceiptIcon } from 'lucide-react';
import { getDashboardData } from '@/lib/dashboard-queries';
import { getCurrentUser } from '@/lib/session';
import { listCategories } from '@/app/actions/categories';
import { listAccounts } from '@/app/actions/accounts';
import { listTransactions } from '@/app/actions/transactions';
import { formatMoney } from '@/lib/money';
import { formatMonth, shiftMonth } from '@/lib/dates';
import { TrendChart, SpendingBars } from '@/components/dashboard-charts';
import { BudgetRow } from '@/components/budget-row';
import { BudgetSummaryCard } from '@/components/budget-summary';
import { summarizeBudgets } from '@/lib/budget-summary';
import { PageHeader } from '@/components/page-header';
import { MonthNav } from '@/components/month-nav';
import { StatCard } from '@/components/stat-card';
import { TransactionRow } from '@/components/transaction-row';
import { dashboardCurrencyOptions, pickDashboardCurrency } from '@/lib/dashboard-currencies';
import { DashboardCurrencySwitcher } from '@/components/dashboard-currency-switcher';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card shadow-xs">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="font-medium">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string; currency?: string }> }) {
  const { month = currentMonth(), currency: requestedCurrency } = await searchParams;
  const user = await getCurrentUser();
  const [data, categories, accounts, allRecent] = await Promise.all([
    getDashboardData(user.id, month),
    listCategories(),
    listAccounts(),
    listTransactions(),
  ]);

  // The dashboard shows one currency at a time — cents from different currencies are never added
  // together. It defaults to the user's first currency in account order; the switcher picks another.
  const activityCurrencies = [...new Set([
    ...Object.keys(data.balancesByCurrency),
    ...Object.keys(data.monthlyIncomeCents),
    ...Object.keys(data.monthlyExpenseCents),
    ...Object.keys(data.reimbursableCents),
    ...data.trend.flatMap((t) => [...Object.keys(t.incomeCents), ...Object.keys(t.expenseCents)]),
    ...data.spendingByCategory.map((s) => s.currency),
  ])];
  const options = dashboardCurrencyOptions(accounts, activityCurrencies);
  const currency = pickDashboardCurrency(options, requestedCurrency);
  const withCurrency = (m: string) => `/dashboard?month=${m}${currency ? `&currency=${currency}` : ''}`;

  const trendSeries = data.trend.map((t) => ({
    month: t.month,
    incomeCents: currency ? t.incomeCents[currency] ?? 0 : 0,
    expenseCents: currency ? t.expenseCents[currency] ?? 0 : 0,
  }));
  const spendingSeries = data.spendingByCategory
    .filter((s) => s.currency === currency)
    .map((s) => {
      const c = categories.find((x) => x.id === s.categoryId);
      return { name: c?.name ?? 'Unknown', icon: c?.icon, cents: s.cents };
    });
  const budgets = data.budgetProgress.filter((p) => p.budget.currency === currency);
  const recent = allRecent.filter((t) => t.currency === currency);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Overview for ${formatMonth(month)}${currency ? ` · ${currency}` : ''}`}
        actions={
          <>
            {options.length > 1 && currency && <DashboardCurrencySwitcher options={options} value={currency} />}
            <MonthNav
              label={formatMonth(month)}
              prevHref={withCurrency(shiftMonth(month, -1))}
              nextHref={withCurrency(shiftMonth(month, 1))}
              todayHref={month === currentMonth() ? undefined : withCurrency(currentMonth())}
            />
          </>
        }
      />

      {!currency ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          No accounts or activity yet. <Link href="/accounts" className="text-primary underline">Add an account</Link> or{' '}
          <Link href="/settings/data" className="text-primary underline">import a backup</Link> to get started.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total balance" icon={<LandmarkIcon />} value={formatMoney(data.balancesByCurrency[currency] ?? 0, currency)} />
            <StatCard label="Income this month" tone="positive" icon={<ArrowDownLeftIcon />} value={formatMoney(data.monthlyIncomeCents[currency] ?? 0, currency)} />
            <StatCard label="Expenses this month" tone="negative" icon={<ArrowUpRightIcon />} value={formatMoney(data.monthlyExpenseCents[currency] ?? 0, currency)} />
            <StatCard label="Reimbursable" tone="neutral" icon={<ReceiptIcon />} value={formatMoney(data.reimbursableCents[currency] ?? 0, currency)} hint="To claim or submitting" />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <Panel title="Income vs expense · last 6 months">
                {trendSeries.some((t) => t.incomeCents || t.expenseCents)
                  ? <TrendChart data={trendSeries} currency={currency} />
                  : <p className="text-sm text-muted-foreground">No income or expenses in {currency} in the last 6 months.</p>}
              </Panel>
            </div>
            <div className="lg:col-span-2">
              <Panel title="Spending by category">
                {spendingSeries.length > 0
                  ? <SpendingBars data={spendingSeries} currency={currency} />
                  : <p className="text-sm text-muted-foreground">No expenses in {currency} this month.</p>}
              </Panel>
            </div>
          </div>
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Budgets" action={<Link href={`/budgets?month=${month}`} className="text-sm text-primary hover:underline">View all</Link>}>
          {budgets.length > 0 ? (
            <div className="space-y-4">
              {summarizeBudgets(budgets).map((sum) => <BudgetSummaryCard key={sum.currency} s={sum} compact />)}
              {budgets.map((p) => <BudgetRow key={p.budget.id} progress={p} compact accounts={accounts} />)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No {currency ? `${currency} ` : ''}budgets set for this month.</p>
          )}
        </Panel>
        <section className="rounded-xl border bg-card shadow-xs">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <h2 className="font-medium">Recent transactions</h2>
            <Link href="/transactions?month=all" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y">
            {recent.slice(0, 8).map((t) => <TransactionRow key={t.id} t={t} accounts={accounts} categories={categories} />)}
            {recent.length === 0 && <p className="p-4 text-sm text-muted-foreground">No {currency ? `${currency} ` : ''}transactions yet.</p>}
          </div>
        </section>
      </div>
    </>
  );
}
