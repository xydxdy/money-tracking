import { describe, it, expect } from 'vitest';
import { formatMoney } from '@/lib/money';
import { COMMON_CURRENCIES, currencySymbol } from '@/lib/currencies';

describe('currency symbols', () => {
  it('shows a symbol for common currencies, like USD -> $', () => {
    expect(formatMoney(100000, 'THB')).toBe('฿1,000.00');
    expect(formatMoney(100000, 'JPY')).toBe('¥1,000');
    expect(formatMoney(100000, 'KRW')).toBe('₩1,000');
    expect(formatMoney(100000, 'EUR')).toBe('€1,000.00');
    expect(formatMoney(100000, 'GBP')).toBe('£1,000.00');
    expect(formatMoney(-500, 'THB')).toBe('-฿5.00');
    expect(formatMoney(6016, 'USD')).toBe('$60.16');
  });

  it('keeps look-alike symbols distinguishable', () => {
    expect(currencySymbol('CNY')).toBe('CN¥');
    expect(currencySymbol('JPY')).toBe('¥');
    expect(currencySymbol('AUD')).toBe('A$');
    expect(currencySymbol('SGD')).toBe('S$');
    expect(formatMoney(100000, 'SGD')).toBe('S$1,000.00');
  });

  it('falls back to the code for a currency it has no symbol for', () => {
    expect(currencySymbol('XYZ')).toBe('XYZ');
    expect(formatMoney(500, 'XYZ')).toMatch(/^XYZ\s?5\.00$/);
  });

  it('has a de-duplicated list of common currencies, each with a symbol and name', () => {
    const codes = COMMON_CURRENCIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of ['USD', 'THB', 'JPY', 'KRW', 'EUR', 'GBP', 'CNY']) expect(codes).toContain(code);
    expect(COMMON_CURRENCIES.every((c) => /^[A-Z]{3}$/.test(c.code) && c.symbol && c.name)).toBe(true);
  });
});
