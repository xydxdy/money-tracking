import { describe, it, expect } from 'vitest';
import { dashboardCurrencyOptions, pickDashboardCurrency } from '@/lib/dashboard-currencies';

const acc = (currency: string, archived = false) => ({ currency, archived });

describe('dashboardCurrencyOptions', () => {
  it('lists currencies in the user’s account order, then any others with activity', () => {
    expect(dashboardCurrencyOptions([acc('THB'), acc('THB'), acc('USD')], ['EUR', 'USD', 'AUD'])).toEqual(['THB', 'USD', 'AUD', 'EUR']);
  });

  it('puts archived accounts’ currencies after active ones', () => {
    expect(dashboardCurrencyOptions([acc('EUR', true), acc('USD')], [])).toEqual(['USD', 'EUR']);
  });

  it('is empty for a user with nothing yet', () => {
    expect(dashboardCurrencyOptions([], [])).toEqual([]);
  });
});

describe('pickDashboardCurrency', () => {
  it('uses the requested currency when it is one of the options (any case)', () => {
    expect(pickDashboardCurrency(['THB', 'USD'], 'usd')).toBe('USD');
  });

  it('defaults to the first option otherwise', () => {
    expect(pickDashboardCurrency(['THB', 'USD'], undefined)).toBe('THB');
    expect(pickDashboardCurrency(['THB', 'USD'], 'JPY')).toBe('THB');
    expect(pickDashboardCurrency([], 'USD')).toBeUndefined();
  });
});
