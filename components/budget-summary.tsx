import { Progress } from '@/components/ui/progress';
import { formatMoney } from '@/lib/money';
import type { BudgetSummary } from '@/lib/budget-summary';

/** The month's budget totals for one currency: planned, spent, remaining and an overall bar. */
export function BudgetSummaryCard({ s, compact = false }: { s: BudgetSummary; compact?: boolean }) {
  const over = s.spentCents > s.plannedCents;
  if (compact) {
    return (
      <div className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-muted-foreground">Total · {s.count} {s.count === 1 ? 'budget' : 'budgets'}</span>
          <span className={`tabular-nums font-medium ${over ? 'text-destructive' : ''}`}>
            {formatMoney(s.spentCents, s.currency)} / {formatMoney(s.plannedCents, s.currency)}
          </span>
        </div>
        <Progress value={Math.min(s.percentUsed, 100)} className={over ? '[&_[data-slot=progress-indicator]]:bg-destructive' : ''} />
        <p className="text-xs text-muted-foreground">
          {over ? `${formatMoney(-s.remainingCents, s.currency)} over` : `${formatMoney(s.remainingCents, s.currency)} left`} · {s.percentUsed.toFixed(0)}% used
          {s.overCount > 0 && <span className="text-destructive"> · {s.overCount} over budget</span>}
        </p>
      </div>
    );
  }
  return (
    <section className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">Summary <span className="text-sm font-normal text-muted-foreground">· {s.currency} · {s.count} {s.count === 1 ? 'budget' : 'budgets'}</span></h2>
        {s.overCount > 0
          ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">{s.overCount} over budget</span>
          : <span className="rounded-full bg-positive/15 px-2 py-0.5 text-xs font-medium text-positive">All within budget</span>}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <dt className="text-xs text-muted-foreground">Planned</dt>
          <dd className="text-lg font-semibold tabular-nums break-words">{formatMoney(s.plannedCents, s.currency)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Spent</dt>
          <dd className={`text-lg font-semibold tabular-nums break-words ${over ? 'text-destructive' : ''}`}>{formatMoney(s.spentCents, s.currency)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{over ? 'Over by' : 'Remaining'}</dt>
          <dd className={`text-lg font-semibold tabular-nums break-words ${over ? 'text-destructive' : 'text-positive'}`}>{formatMoney(Math.abs(s.remainingCents), s.currency)}</dd>
        </div>
      </dl>
      <Progress value={Math.min(s.percentUsed, 100)} className={`mt-3 ${over ? '[&_[data-slot=progress-indicator]]:bg-destructive' : ''}`} />
      <p className="mt-1 text-xs text-muted-foreground">{s.percentUsed.toFixed(0)}% of planned spending used</p>
    </section>
  );
}
