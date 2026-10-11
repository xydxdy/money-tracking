import { toCents } from '@/lib/money';

/** Income minus expenses per currency (cents); transfers and loans move money but don't count. */
export function netByCurrency(rows: { type: string; amount: string; currency: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.type !== 'income' && r.type !== 'expense') continue;
    out[r.currency] = (out[r.currency] ?? 0) + (r.type === 'income' ? 1 : -1) * toCents(r.amount);
  }
  return out;
}
