import { describe, it, expect } from 'vitest';
import { toCents, fromCents, addCents, formatMoney, sanitizeAmount } from '@/lib/money';

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

describe('sanitizeAmount', () => {
  it('keeps digits and one decimal point with up to two decimals', () => {
    expect(sanitizeAmount('12.50')).toBe('12.50');
    expect(sanitizeAmount('abc12x')).toBe('12');
    expect(sanitizeAmount('-5')).toBe('5');
    expect(sanitizeAmount('1,200.75')).toBe('1200.75');
    expect(sanitizeAmount('1.2.3')).toBe('1.23');
    expect(sanitizeAmount('9.999')).toBe('9.99');
    expect(sanitizeAmount('.5')).toBe('.5');
    expect(sanitizeAmount('฿ 300')).toBe('300');
    expect(sanitizeAmount('')).toBe('');
  });
});
