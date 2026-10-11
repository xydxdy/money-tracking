import { describe, it, expect } from 'vitest';
import { summarizeReimbursements, nextReimbursementStatus, REIMBURSEMENT_STATUSES } from '@/lib/reimbursements';

const r = (status: string | null, amount: string, currency = 'USD') => ({ reimbursementStatus: status, amount, currency });

describe('summarizeReimbursements', () => {
  it('counts and totals each status per currency, treating no status as "to claim"', () => {
    const s = summarizeReimbursements([r('to_claim', '10.00'), r(null, '5.50'), r('submitting', '20.00'), r('submitting', '100.00', 'THB'), r('claimed', '7.25')]);
    expect(s.to_claim).toEqual({ count: 2, totals: { USD: 1550 } });
    expect(s.submitting).toEqual({ count: 2, totals: { USD: 2000, THB: 10000 } });
    expect(s.claimed).toEqual({ count: 1, totals: { USD: 725 } });
    expect(s.denied).toEqual({ count: 0, totals: {} });
    expect(s.all.count).toBe(5);
  });

  it('is all zeros for no reimbursements', () => {
    const s = summarizeReimbursements([]);
    for (const k of [...REIMBURSEMENT_STATUSES, 'all'] as const) expect(s[k]).toEqual({ count: 0, totals: {} });
  });
});

describe('nextReimbursementStatus', () => {
  it('moves forward one step, and has no step after claimed', () => {
    expect(nextReimbursementStatus('to_claim')).toBe('submitting');
    expect(nextReimbursementStatus(null)).toBe('submitting');
    expect(nextReimbursementStatus('submitting')).toBe('claimed');
    expect(nextReimbursementStatus('claimed')).toBeNull();
    expect(nextReimbursementStatus('denied')).toBeNull();
  });
});

describe('denied reimbursements', () => {
  it('are counted under their own status', () => {
    const s = summarizeReimbursements([r('denied', '30.00'), r('claimed', '5.00')]);
    expect(s.denied).toEqual({ count: 1, totals: { USD: 3000 } });
    expect(REIMBURSEMENT_STATUSES).toContain('denied');
  });
});
