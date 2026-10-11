'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { formatMoney } from '@/lib/money';
import { formatMonth } from '@/lib/dates';

// Each call renders a single currency's series — the page extracts one currency's numbers out of
// getDashboardData's per-currency Records before calling these, so no chart ever mixes amounts
// from two different currencies.
//
// Colours: income/expense use the validated colour-blind-safe blue/orange pair defined as
// --series-income / --series-expense in globals.css (light and dark steps). Text stays in the
// theme's text tokens, never the series colour.

const shortMonth = (month: string) => formatMonth(month).slice(0, 3);

export function TrendChart({ data, currency }: {
  data: { month: string; incomeCents: number; expenseCents: number }[]; currency: string;
}) {
  const rows = data.map((d) => ({ month: d.month, income: d.incomeCents, expense: d.expenseCents }));
  const money = (cents: number) => formatMoney(cents, currency);
  const compact = (cents: number) =>
    new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(cents / 100);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="month" tickFormatter={shortMonth} tickLine={false} axisLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
        <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={44}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
        <Tooltip
          cursor={{ fill: 'var(--accent)', opacity: 0.5 }}
          formatter={(value, name) => [money(Number(value)), name === 'income' ? 'Income' : 'Expense']}
          labelFormatter={(label) => formatMonth(String(label))}
          contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--popover-foreground)' }}
        />
        <Legend formatter={(value) => <span className="text-sm text-muted-foreground">{value === 'income' ? 'Income' : 'Expense'}</span>}
          iconType="circle" iconSize={8} />
        <Bar dataKey="income" fill="var(--series-income)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="expense" fill="var(--series-expense)" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Spending by category as a ranked bar list: a single series (one hue), sorted largest first,
 * each bar labelled with its amount and share. Replaces the pie, which couldn't stay within a
 * readable number of colours once there are more than a handful of categories.
 */
export function SpendingBars({ data, currency }: { data: { name: string; icon?: string | null; cents: number }[]; currency: string }) {
  const sorted = [...data].sort((a, b) => b.cents - a.cents);
  const total = sorted.reduce((sum, d) => sum + d.cents, 0);
  const max = sorted[0]?.cents ?? 0;
  return (
    <ul className="space-y-3">
      {sorted.map((d) => {
        const share = total ? Math.round((d.cents / total) * 100) : 0;
        return (
          <li key={d.name} title={`${d.name}: ${formatMoney(d.cents, currency)} (${share}%)`}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate">{d.icon} {d.name}</span>
              <span className="shrink-0 tabular-nums">
                {formatMoney(d.cents, currency)} <span className="text-muted-foreground">· {share}%</span>
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full" style={{ width: `${max ? Math.max((d.cents / max) * 100, 2) : 0}%`, background: 'var(--series-income)' }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
