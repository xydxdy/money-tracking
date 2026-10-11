'use client';
import { useState } from 'react';
import { EditTransactionLink } from '@/components/edit-transaction-link';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLinkIcon } from 'lucide-react';
import { safeHref } from '@/lib/link';
import { setReimbursementStatus } from '@/app/actions/reimbursements';
import { formatDate } from '@/lib/dates';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUSES = ['to_claim', 'submitting', 'claimed'] as const;
const STATUS_LABELS: Record<(typeof STATUSES)[number], string> = {
  to_claim: 'To claim',
  submitting: 'Submitting',
  claimed: 'Claimed',
};

export function ReimbursementRow({ id, details, payDate, amountLabel, status, link }: {
  id: string; details: string; payDate: string; amountLabel: string; status: (typeof STATUSES)[number]; link?: string | null;
}) {
  const href = safeHref(link);
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(v: string | null) {
    if (!v) return;
    const next = v as typeof current;
    const previous = current;
    setCurrent(next);
    setError(null);
    try {
      await setReimbursementStatus(id, next);
      // Re-run the page query so a status filter, if any, drops or keeps this row.
      router.refresh();
    } catch {
      // Roll back the optimistic update if the server rejected it (e.g. the
      // transaction was deleted by another request in the meantime), rather
      // than leaving the dropdown showing a status that was never persisted.
      setCurrent(previous);
      setError('Could not update status. Please try again.');
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 transition-colors hover:bg-accent/30 sm:flex-nowrap">
      <div className="min-w-0">
        <Link href={`/transactions/${id}`} className="font-medium hover:underline">{details}</Link>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <span>{formatDate(payDate)} · {amountLabel}</span>
          {href && (
            <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline">
              Receipt <ExternalLinkIcon className="size-3" />
            </a>
          )}
        </p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      {/* `items` (a value->label map) is required here, not optional styling: this Select's
          value ('to_claim') differs from its human-readable label ('To claim'), and Base UI's
          <Select.Value> renders the raw value in the trigger unless `items` is supplied — see
          the same gap documented in components/transaction-form.tsx and components/budget-form.tsx. */}
      <div className="flex shrink-0 items-center gap-1">
      <EditTransactionLink id={id} details={details} />
      <Select value={current} onValueChange={handleChange} items={STATUS_LABELS}>
        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
        </SelectContent>
      </Select>
      </div>
    </div>
  );
}
