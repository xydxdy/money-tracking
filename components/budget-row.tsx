import type { ReactNode } from 'react';
import { EditTransactionLink } from '@/components/edit-transaction-link';
import Link from 'next/link';
import { ChevronRightIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { formatMoney, toCents } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import type { calculateBudgetProgress } from '@/lib/budget-calc';

type BudgetProgress = Awaited<ReturnType<typeof calculateBudgetProgress>>[number];

/**
 * A budget's progress that expands (click) to list the transactions counted against it.
 * `actions` (edit/delete buttons) sit outside the clickable summary so they don't toggle it.
 */
export function BudgetRow({ progress, actions, compact = false }: { progress: BudgetProgress; actions?: ReactNode; compact?: boolean }) {
  const { budget, category, plannedCents, spentCents, remainingCents, percentUsed, transactions } = progress;
  return (
    <div className={compact ? '' : 'rounded-xl border bg-card p-4 shadow-xs'}>
      <div className="flex items-start gap-3">
        <details className="group min-w-0 flex-1">
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <div className={`flex items-center justify-between gap-2 ${compact ? 'text-sm' : ''}`}>
              <span className="flex min-w-0 items-center gap-1">
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                <span className="truncate">{category.icon} {category.name}</span>
              </span>
              <span className={`shrink-0 tabular-nums ${percentUsed > 100 ? 'font-medium text-destructive' : ''}`}>
                {formatMoney(spentCents, budget.currency)} / {formatMoney(plannedCents, budget.currency)}
              </span>
            </div>
            <Progress value={Math.min(percentUsed, 100)} className={`mt-2 ${percentUsed > 100 ? '[&_[data-slot=progress-indicator]]:bg-destructive' : ''}`} />
            <p className="mt-1 text-sm text-muted-foreground">
              Remaining: {formatMoney(remainingCents, budget.currency)} ({percentUsed.toFixed(0)}% used) · {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}
            </p>
          </summary>
          <div className="mt-3 rounded-md border divide-y">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-1 pr-1 hover:bg-accent/40">
                <Link href={`/transactions/${t.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{t.details}</span>
                  <span className="flex shrink-0 gap-3">
                    <span className="text-muted-foreground">{formatDate(t.payDate)}</span>
                    <span>{formatMoney(toCents(t.amount), t.currency)}</span>
                  </span>
                </Link>
                <EditTransactionLink id={t.id} details={t.details} />
              </div>
            ))}
            {transactions.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No transactions in this budget yet.</p>}
          </div>
        </details>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
