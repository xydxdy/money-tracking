import { describe, it, expect } from 'vitest';
import { netByCurrency } from '@/lib/day-totals';

const t = (type: string, amount: string, currency = 'USD') => ({ type, amount, currency });

describe('netByCurrency', () => {
  it('adds income and subtracts expenses per currency, ignoring transfers and loans', () => {
    expect(netByCurrency([t('expense', '12.50'), t('income', '100.00'), t('expense', '300', 'THB'), t('transfer', '50.00'), t('loan', '20.00')]))
      .toEqual({ USD: 8750, THB: -30000 });
  });

  it('is empty when nothing counts', () => {
    expect(netByCurrency([t('transfer', '5.00')])).toEqual({});
  });
});
