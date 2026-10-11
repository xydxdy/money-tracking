import { toCents } from '@/lib/money';

// Order: to_claim -> submitting -> claimed (paid back) or denied (rejected). Claimed and denied are final.
export const REIMBURSEMENT_STATUSES = ['to_claim', 'submitting', 'claimed', 'denied'] as const;
export type ReimbursementStatus = (typeof REIMBURSEMENT_STATUSES)[number];

export const REIMBURSEMENT_LABELS: Record<ReimbursementStatus, string> = {
  to_claim: 'To claim',
  submitting: 'Submitting',
  claimed: 'Claimed',
  denied: 'Denied',
};

/** The next step for an item (a reimbursable transaction with no status yet counts as "to claim"). */
export function nextReimbursementStatus(status: string | null): ReimbursementStatus | null {
  const current = status ?? 'to_claim';
  if (current === 'to_claim') return 'submitting';
  if (current === 'submitting') return 'claimed';
  return null; // claimed and denied are final
}

type Bucket = { count: number; totals: Record<string, number> };

/** Count and per-currency totals (cents) for each status and for all items together. */
export function summarizeReimbursements(rows: { reimbursementStatus: string | null; amount: string; currency: string }[]) {
  const empty = (): Bucket => ({ count: 0, totals: {} });
  const out: Record<ReimbursementStatus | 'all', Bucket> = { to_claim: empty(), submitting: empty(), claimed: empty(), denied: empty(), all: empty() };
  for (const r of rows) {
    const status = (REIMBURSEMENT_STATUSES as readonly string[]).includes(r.reimbursementStatus ?? '')
      ? (r.reimbursementStatus as ReimbursementStatus) : 'to_claim';
    for (const b of [out[status], out.all]) {
      b.count += 1;
      b.totals[r.currency] = (b.totals[r.currency] ?? 0) + toCents(r.amount);
    }
  }
  return out;
}
