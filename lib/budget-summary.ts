export type BudgetSummary = {
  currency: string;
  count: number;
  /** Budgets whose spending is above their planned amount. */
  overCount: number;
  plannedCents: number;
  spentCents: number;
  remainingCents: number;
  percentUsed: number;
};

/**
 * Month totals of a set of budgets, one row per currency (budget amounts in different currencies
 * are never added together). `preferred` currencies come first (e.g. the user's currencies in
 * account order), then the rest alphabetically.
 */
export function summarizeBudgets(
  rows: { budget: { currency: string }; plannedCents: number; spentCents: number }[],
  preferred: string[] = [],
): BudgetSummary[] {
  const byCurrency = new Map<string, BudgetSummary>();
  for (const r of rows) {
    const c = r.budget.currency;
    const s = byCurrency.get(c) ?? { currency: c, count: 0, overCount: 0, plannedCents: 0, spentCents: 0, remainingCents: 0, percentUsed: 0 };
    s.count += 1;
    s.plannedCents += r.plannedCents;
    s.spentCents += r.spentCents;
    if (r.spentCents > r.plannedCents) s.overCount += 1;
    byCurrency.set(c, s);
  }
  const rank = (c: string) => (preferred.includes(c) ? preferred.indexOf(c) : Infinity);
  return [...byCurrency.values()]
    .map((s) => ({
      ...s,
      remainingCents: s.plannedCents - s.spentCents,
      percentUsed: s.plannedCents === 0 ? 0 : Math.round((s.spentCents / s.plannedCents) * 10000) / 100,
    }))
    .sort((a, b) => rank(a.currency) - rank(b.currency) || a.currency.localeCompare(b.currency));
}
