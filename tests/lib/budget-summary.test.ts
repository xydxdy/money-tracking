import { describe, it, expect } from 'vitest';
import { summarizeBudgets } from '@/lib/budget-summary';

const b = (currency: string, plannedCents: number, spentCents: number) => ({ budget: { currency }, plannedCents, spentCents });

describe('summarizeBudgets', () => {
  it('totals planned, spent and remaining per currency, with the share used and how many are over', () => {
    const summary = summarizeBudgets([b('USD', 30000, 17000), b('USD', 10000, 12500), b('THB', 500000, 100000)], ['USD', 'THB']);
    expect(summary).toEqual([
      { currency: 'USD', count: 2, overCount: 1, plannedCents: 40000, spentCents: 29500, remainingCents: 10500, percentUsed: 73.75 },
      { currency: 'THB', count: 1, overCount: 0, plannedCents: 500000, spentCents: 100000, remainingCents: 400000, percentUsed: 20 },
    ]);
  });

  it('orders currencies by the given preference, then alphabetically', () => {
    const rows = [b('THB', 100, 0), b('USD', 50, 0), b('EUR', 900, 0)];
    expect(summarizeBudgets(rows, ['USD']).map((s) => s.currency)).toEqual(['USD', 'EUR', 'THB']);
  });

  it('handles nothing planned without dividing by zero', () => {
    expect(summarizeBudgets([b('USD', 0, 500)])[0]).toMatchObject({ percentUsed: 0, remainingCents: -500, overCount: 1 });
    expect(summarizeBudgets([])).toEqual([]);
  });
});
