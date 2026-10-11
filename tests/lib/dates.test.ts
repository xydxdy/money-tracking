import { describe, it, expect } from 'vitest';
import { formatDate, formatMonth, parseDisplayDate } from '@/lib/dates';

describe('formatDate', () => {
  it('formats an ISO date as DD/MM/YYYY', () => {
    expect(formatDate('2026-10-05')).toBe('05/10/2026');
    expect(formatDate('2026-01-31')).toBe('31/01/2026');
  });
});

describe('formatMonth', () => {
  it('formats YYYY-MM as "Month YYYY"', () => {
    expect(formatMonth('2026-10')).toBe('October 2026');
    expect(formatMonth('2027-01')).toBe('January 2027');
  });
});

describe('parseDisplayDate', () => {
  it('parses DD/MM/YYYY into an ISO date', () => {
    expect(parseDisplayDate('05/10/2026')).toBe('2026-10-05');
    expect(parseDisplayDate('5/1/2026')).toBe('2026-01-05');
  });

  it('rejects malformed or impossible dates', () => {
    expect(parseDisplayDate('2026-10-05')).toBeNull();
    expect(parseDisplayDate('31/02/2026')).toBeNull();
    expect(parseDisplayDate('00/10/2026')).toBeNull();
    expect(parseDisplayDate('')).toBeNull();
  });
});

import { monthRange, shiftMonth } from '@/lib/dates';

describe('monthRange', () => {
  it('returns the first and last day of a month', () => {
    expect(monthRange('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('shiftMonth', () => {
  it('moves across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});
