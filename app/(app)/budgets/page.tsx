import { listBudgetProgress, copyPreviousMonth, deleteBudget } from '@/app/actions/budgets';
import { ConfirmButton } from '@/components/confirm-button';
import { BudgetEditDialog } from '@/components/budget-edit-dialog';
import { formatMonth } from '@/lib/dates';
import { CopyIcon } from 'lucide-react';
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

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month = currentMonth() } = await searchParams;
  const [progress, categories, accounts] = await Promise.all([listBudgetProgress(month), listCategories(), listAccounts()]);
  // New budgets default to the user's main currency: their first active account's.
  const defaultCurrency = accounts.find((a) => !a.archived)?.currency ?? 'USD';
  // Month totals per currency, the user's account currencies first.
  const summaries = summarizeBudgets(progress, dashboardCurrencyOptions(accounts, []));

  async function copyPreviousMonthAction() {
    'use server';
    await copyPreviousMonth(previousMonth(month), month);
  }

  return (
    <>
      <PageHeader
        title="Budgets"
        description={progress.length > 0 ? `${progress.length} ${progress.length === 1 ? 'budget' : 'budgets'} · click one to see its transactions` : undefined}
        actions={<CreateBudgetDialog month={month} monthLabel={formatMonth(month)} categories={categories} defaultCurrency={defaultCurrency} />}
      >
        <MonthNav
          label={formatMonth(month)}
          prevHref={`/budgets?month=${previousMonth(month)}`}
          nextHref={`/budgets?month=${nextMonth(month)}`}
          todayHref={month === currentMonth() ? undefined : '/budgets'}
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
      <div className="space-y-3">
        {progress.map((p) => (
          <BudgetRow
            key={p.budget.id}
            progress={p}
            actions={<>
              <BudgetEditDialog budget={p.budget} categories={categories} />
              <ConfirmButton
                label="Delete"
                description={`Delete the ${p.category.name} budget for ${formatMonth(month)}? Transactions are not affected.`}
                confirmText={p.category.name}
                onConfirm={async () => { 'use server'; await deleteBudget(p.budget.id); }}
              />
            </>}
          />
        ))}
        {progress.length === 0 && (
          <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No budgets for {formatMonth(month)} yet. Create one, or copy last month&apos;s.
          </div>
        )}
      </div>
    </>
  );
}
