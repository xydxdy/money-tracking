import { describe, it, expect } from 'vitest';
import { toCents, fromCents, addCents, formatMoney } from '@/lib/money';

describe('money helpers', () => {
  it('converts a numeric string to integer cents', () => {
    expect(toCents('60.16')).toBe(6016);
    expect(toCents('0')).toBe(0);
    expect(toCents('3217')).toBe(321700);
  });

  it('converts cents back to a numeric string', () => {
    expect(fromCents(6016)).toBe('60.16');
    expect(fromCents(0)).toBe('0.00');
  });

  it('adds cents without float drift', () => {
    expect(addCents(toCents('0.10'), toCents('0.20'))).toBe(30);
  });

  it('formats money with currency', () => {
    expect(formatMoney(6016, 'USD')).toBe('$60.16');
    expect(formatMoney(-321700, 'USD')).toBe('-$3,217.00');
  });
});
