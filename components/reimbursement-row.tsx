'use client';
import { useState } from 'react';
import { setReimbursementStatus } from '@/app/actions/reimbursements';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUSES = ['to_claim', 'claimed', 'reimbursed'] as const;
const STATUS_LABELS: Record<(typeof STATUSES)[number], string> = {
  to_claim: 'To claim',
  claimed: 'Claimed',
  reimbursed: 'Reimbursed',
};

export function ReimbursementRow({ id, details, payDate, amountLabel, status }: {
  id: string; details: string; payDate: string; amountLabel: string; status: (typeof STATUSES)[number];
}) {
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
    } catch {
      // Roll back the optimistic update if the server rejected it (e.g. the
      // transaction was deleted by another request in the meantime), rather
      // than leaving the dropdown showing a status that was never persisted.
      setCurrent(previous);
      setError('Could not update status. Please try again.');
    }
  }

  return (
    <div className="flex items-center justify-between p-3">
      <div>
        <p className="font-medium">{details}</p>
        <p className="text-sm text-muted-foreground">{payDate} · {amountLabel}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      {/* `items` (a value->label map) is required here, not optional styling: this Select's
          value ('to_claim') differs from its human-readable label ('To claim'), and Base UI's
          <Select.Value> renders the raw value in the trigger unless `items` is supplied — see
          the same gap documented in components/transaction-form.tsx and components/budget-form.tsx. */}
      <Select value={current} onValueChange={handleChange} items={STATUS_LABELS}>
        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
