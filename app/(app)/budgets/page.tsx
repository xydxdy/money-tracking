import { BudgetActions } from '@/components/budget-actions';
import { BudgetTransactionList } from '@/components/budget-transaction-list';
import Link from 'next/link';
import { CategoryIcon } from '@/components/app-icon';
import { BUDGET_SORTS, sortBudgets, unbudgetedSpending, type BudgetSort } from '@/lib/budget-insights';
import { formatMoney } from '@/lib/money';
import { getCurrentUser } from '@/lib/session';
import { listBudgetProgress, copyPreviousMonth, deleteBudget } from '@/app/actions/budgets';
import { formatMonth } from '@/lib/dates';
import { ChevronRightIcon, CopyIcon, PiggyBankIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { MonthNav } from '@/components/month-nav';
import { listCategories } from '@/app/actions/categories';
import { listAccounts } from '@/app/actions/accounts';
import { CreateBudgetDialog } from '@/components/create-dialogs';
import { BudgetRow } from '@/components/budget-row';
import { BudgetSummaryCard } from '@/components/budget-summary';
import { summarizeBudgets } from '@/lib/budget-summary';
import { dashboardCurrencyOptions } from '@/lib/dashboard-currencies';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function previousMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

function nextMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
}

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ month?: string; sort?: string }> }) {
  const { month = currentMonth(), sort: requestedSort } = await searchParams;
  const sort: BudgetSort = requestedSort && requestedSort in BUDGET_SORTS ? (requestedSort as BudgetSort) : 'name';
  const user = await getCurrentUser();
  const [progress, categories, accounts, unbudgeted] = await Promise.all([
    listBudgetProgress(month), listCategories(), listAccounts(), unbudgetedSpending(user.id, month),
  ]);
  // New budgets default to the user's main currency: their first active account's.
  const defaultCurrency = accounts.find((a) => !a.archived)?.currency ?? 'USD';
  const currencyOrder = dashboardCurrencyOptions(accounts, []);
  // Budgets can only use the currencies of the user's accounts.
  const accountCurrencies = [...new Set(accounts.map((a) => a.currency))];
  // Month totals per currency, the user's account currencies first.
  const summaries = summarizeBudgets(progress, currencyOrder);
  // One section per currency (in the same order as the summaries), each sorted as chosen.
  const sections = summaries.map((sum) => ({
    currency: sum.currency,
    rows: sortBudgets(progress.filter((p) => p.budget.currency === sum.currency), sort),
  }));
  const overCount = progress.filter((p) => p.spentCents > p.plannedCents).length;
  const href = (changes: { month?: string; sort?: BudgetSort }) => {
    const q = new URLSearchParams();
    const m = changes.month ?? month;
    if (m !== currentMonth()) q.set('month', m);
    const so = changes.sort ?? sort;
    if (so !== 'name') q.set('sort', so);
    const qs = q.toString();
    return qs ? `/budgets?${qs}` : '/budgets';
  };

  async function copyPreviousMonthAction() {
    'use server';
    await copyPreviousMonth(previousMonth(month), month);
  }

  return (
    <>
      <PageHeader
        title="Budgets"
        description={progress.length > 0
          ? `${progress.length} ${progress.length === 1 ? 'budget' : 'budgets'}${overCount ? ` · ${overCount} over` : ''} · click one to see its transactions`
          : undefined}
        actions={<CreateBudgetDialog month={month} monthLabel={formatMonth(month)} categories={categories} currencies={accountCurrencies} defaultCurrency={defaultCurrency} />}
      >
        <MonthNav
          label={formatMonth(month)}
          prevHref={href({ month: previousMonth(month) })}
          nextHref={href({ month: nextMonth(month) })}
          todayHref={month === currentMonth() ? undefined : href({ month: currentMonth() })}
          extra={
            <form action={copyPreviousMonthAction}>
              <Button type="submit" variant="ghost" size="sm"><CopyIcon /> Copy previous month</Button>
            </form>
          }
        />
      </PageHeader>

      {summaries.length > 0 && (
        <div className={`grid gap-4 ${summaries.length > 1 ? 'lg:grid-cols-2' : ''}`}>
          {summaries.map((sum) => <BudgetSummaryCard key={sum.currency} s={sum} />)}
        </div>
      )}

      {progress.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          <PiggyBankIcon className="mx-auto mb-2 size-6" />
          No budgets for {formatMonth(month)} yet. Create one, or copy last month&apos;s.
        </div>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Budgets</h2>
            <nav className="flex gap-1 rounded-lg bg-muted p-1" aria-label="Sort budgets">
              {(Object.entries(BUDGET_SORTS) as [BudgetSort, string][]).map(([key, label]) => (
                <Link key={key} href={href({ sort: key })} aria-current={sort === key ? 'true' : undefined}
                  className={`rounded-md px-3 py-1 text-sm transition-colors ${sort === key ? 'bg-card font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}>
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          {sections.map((section) => (
            <div key={section.currency} className="space-y-2">
              {sections.length > 1 && <h3 className="text-xs font-medium text-muted-foreground">{section.currency}</h3>}
              <div className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
              {section.rows.map((p) => (
                <BudgetRow
                  key={p.budget.id}
                  progress={p}
                  accounts={accounts}
                  actions={
                    <BudgetActions
                      budget={p.budget}
                      categories={categories}
                      currencies={accountCurrencies}
                      categoryName={p.category.name}
                      monthLabel={formatMonth(month)}
                      onDelete={async () => { 'use server'; await deleteBudget(p.budget.id); }}
                    />
                  }
                />
              ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {unbudgeted.length > 0 && (
        <section className="rounded-xl border bg-card shadow-xs">
          <div className="border-b px-4 py-3">
            <h2 className="font-medium">Spending without a budget</h2>
            <p className="text-sm text-muted-foreground">Categories you spent on in {formatMonth(month)} that have no budget in that currency. Click one to see its transactions.</p>
          </div>
          <div className="divide-y">
            {unbudgeted.map((u) => (
              <div key={`${u.categoryId}-${u.currency}`} className="flex items-start gap-3 px-4 py-3">
                <details className="group min-w-0 flex-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                    <span className="flex min-w-0 items-center gap-2">
                      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                      <CategoryIcon name={u.category.icon} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{u.category.name}</span>
                        <span className="block text-xs text-muted-foreground">{u.count} {u.count === 1 ? 'transaction' : 'transactions'}</span>
                      </span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{formatMoney(u.spentCents, u.currency)}</span>
                  </summary>
                  <BudgetTransactionList
                    transactions={u.transactions}
                    accounts={accounts}
                    viewHref={`/transactions?categoryId=${u.categoryId}&month=${month}`}
                  />
                </details>
                {accountCurrencies.includes(u.currency) ? (
                  <CreateBudgetDialog month={month} monthLabel={formatMonth(month)} categories={categories}
                    currencies={accountCurrencies} defaultCurrency={u.currency} defaultCategoryId={u.categoryId} triggerLabel="Add budget" subtle />
                ) : (
                  <span className="shrink-0 pt-1 text-xs text-muted-foreground" title="Budgets use your accounts' currencies">No {u.currency} account</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
