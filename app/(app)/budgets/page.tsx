import { listBudgetProgress, copyPreviousMonth } from '@/app/actions/budgets';
import { listCategories } from '@/app/actions/categories';
import { formatMoney } from '@/lib/money';
import { BudgetForm } from '@/components/budget-form';
import { Progress } from '@/components/ui/progress';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function previousMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month = currentMonth() } = await searchParams;
  const [progress, categories] = await Promise.all([listBudgetProgress(month), listCategories()]);

  async function copyPreviousMonthAction() {
    'use server';
    await copyPreviousMonth(previousMonth(month), month);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Budgets — {month}</h1>
        <form action={copyPreviousMonthAction}>
          <button type="submit" className="text-sm underline">Copy previous month</button>
        </form>
      </div>
      <div className="space-y-3">
        {progress.map((p) => (
          <div key={p.budget.id} className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span>{p.category.icon} {p.category.name}</span>
              <span className={p.percentUsed > 100 ? 'text-destructive font-medium' : ''}>
                {formatMoney(p.spentCents, p.budget.currency)} / {formatMoney(p.plannedCents, p.budget.currency)}
              </span>
            </div>
            <Progress value={Math.min(p.percentUsed, 100)} className="mt-2" />
            <p className="mt-1 text-sm text-muted-foreground">
              Remaining: {formatMoney(p.remainingCents, p.budget.currency)} ({p.percentUsed.toFixed(0)}% used)
            </p>
          </div>
        ))}
        {progress.length === 0 && <p className="text-muted-foreground">No budgets for this month yet.</p>}
      </div>
      <BudgetForm month={month} categories={categories} />
    </div>
  );
}
