import type { ReactNode } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import { BudgetTransactionList } from '@/components/budget-transaction-list';
import { Progress } from '@/components/ui/progress';
import { CategoryIcon } from '@/components/app-icon';
import { formatMoney } from '@/lib/money';
import type { calculateBudgetProgress } from '@/lib/budget-calc';
import type { Account } from '@/db/schema';
import { budgetTone } from '@/lib/budget-insights';

type BudgetProgress = Awaited<ReturnType<typeof calculateBudgetProgress>>[number];

/** Colours per state: on track (green), close to the limit (amber), over (red). */
const TONE = {
  bar: {
    ok: '[&_[data-slot=progress-indicator]]:bg-positive',
    warning: '[&_[data-slot=progress-indicator]]:bg-amber-500',
    over: '[&_[data-slot=progress-indicator]]:bg-destructive',
  },
  badge: {
    ok: 'bg-positive/15 text-positive',
    warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    over: 'bg-destructive/10 text-destructive',
  },
  text: { ok: 'text-positive', warning: 'text-amber-700 dark:text-amber-300', over: 'text-destructive' },
} as const;

/**
 * A budget's progress that expands (click) to list the transactions counted against it.
 * `actions` (edit/delete buttons) sit outside the clickable summary so they don't toggle it.
 */
export function BudgetRow({ progress, actions, compact = false, accounts = [] }: {
  progress: BudgetProgress; actions?: ReactNode; compact?: boolean;
  /** Used to show each transaction's account in the expanded list. */
  accounts?: Pick<Account, 'id' | 'name' | 'icon' | 'color'>[];
}) {
  const { budget, category, plannedCents, spentCents, remainingCents, percentUsed, transactions } = progress;
  const tone = budgetTone(percentUsed);
  return (
    <div className={compact ? '' : 'p-4'}>
      <div className="flex items-start gap-3">
        <details className="group min-w-0 flex-1">
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <div className={`flex items-center justify-between gap-2 ${compact ? 'text-sm' : ''}`}>
              <span className="flex min-w-0 items-center gap-2">
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                <CategoryIcon name={category.icon} size={compact ? 'sm' : 'md'} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{category.name}</span>
                  {!compact && (
                    <span className="block text-xs text-muted-foreground">
                      {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}
                    </span>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-right tabular-nums">
                  <span className={tone === 'over' ? 'font-medium text-destructive' : 'font-medium'}>{formatMoney(spentCents, budget.currency)}</span>
                  <span className="text-muted-foreground"> / {formatMoney(plannedCents, budget.currency)}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${TONE.badge[tone]}`}>{percentUsed.toFixed(0)}%</span>
              </span>
            </div>
            <Progress value={Math.min(percentUsed, 100)} className={`mt-2 ${TONE.bar[tone]}`} />
            <p className={`mt-1 text-xs ${TONE.text[tone]}`}>
              {remainingCents >= 0
                ? `${formatMoney(remainingCents, budget.currency)} left`
                : `${formatMoney(-remainingCents, budget.currency)} over budget`}
              {compact && <span className="text-muted-foreground"> · {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}</span>}
            </p>
          </summary>
          <BudgetTransactionList
            transactions={transactions}
            accounts={accounts}
            plannedCents={plannedCents}
            viewHref={`/transactions?categoryId=${category.id}&month=${budget.month}`}
          />
        </details>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
