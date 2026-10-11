'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRightIcon, ExternalLinkIcon } from 'lucide-react';
import { setReimbursementStatus } from '@/app/actions/reimbursements';
import { formatDate } from '@/lib/dates';
import { safeHref } from '@/lib/link';
import { REIMBURSEMENT_LABELS, REIMBURSEMENT_STATUSES, nextReimbursementStatus, type ReimbursementStatus } from '@/lib/reimbursements';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TransactionIcon } from '@/components/transaction-icon';

/** Badge colours per status: waiting (amber), in progress (blue), paid back (green), rejected (red). */
export const STATUS_TONES: Record<ReimbursementStatus, string> = {
  to_claim: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  submitting: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  claimed: 'bg-positive/15 text-positive',
  denied: 'bg-destructive/10 text-destructive',
};
const NEXT_LABELS: Record<ReimbursementStatus, string> = { to_claim: '', submitting: 'Submit', claimed: 'Mark claimed', denied: '' };

export function ReimbursementRow({ id, details, payDate, amountLabel, status, link, categoryIcon, meta }: {
  id: string; details: string; payDate: string; amountLabel: string; status: ReimbursementStatus;
  link?: string | null; categoryIcon?: string | null; meta?: string;
}) {
  const router = useRouter();
  const href = safeHref(link);
  const [current, setCurrent] = useState(status);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = nextReimbursementStatus(current);

  async function change(to: ReimbursementStatus) {
    const previous = current;
    setCurrent(to);
    setError(null);
    setPending(true);
    try {
      await setReimbursementStatus(id, to);
      // Re-run the page query so the counts, summary and any status tab stay in step.
      router.refresh();
    } catch {
      // Roll back the optimistic update if the server rejected it.
      setCurrent(previous);
      setError('Could not update status. Please try again.');
    } finally {
      setPending(false);
    }
  }

  const items = Object.fromEntries(REIMBURSEMENT_STATUSES.map((s) => [s, REIMBURSEMENT_LABELS[s]]));

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 transition-colors hover:bg-accent/30 sm:flex-nowrap">
      <Link href={`/transactions/${id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <TransactionIcon categoryIcon={categoryIcon ?? null} type="expense" />
        <div className="min-w-0">
          <p className="truncate font-medium hover:underline">{details}</p>
          <p className="truncate text-sm text-muted-foreground">{[formatDate(payDate), meta].filter(Boolean).join(' · ')}</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
      </Link>
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <span className="mr-1 font-medium tabular-nums">{amountLabel}</span>
        {href && (
          <a href={href} target="_blank" rel="noopener noreferrer" title="Open receipt" aria-label="Open receipt"
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground">
            <ExternalLinkIcon className="size-4" />
          </a>
        )}
        <Select value={current} onValueChange={(v) => v && v !== current && change(v as ReimbursementStatus)} items={items}>
          <SelectTrigger size="sm" aria-label="Status" className={`w-32 border-transparent font-medium ${STATUS_TONES[current]}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {REIMBURSEMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{REIMBURSEMENT_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        {next ? (
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => change(next)} className="w-32">
            {NEXT_LABELS[next]} <ArrowRightIcon />
          </Button>
        ) : <span className="w-32" aria-hidden />}
      </div>
    </div>
  );
}
