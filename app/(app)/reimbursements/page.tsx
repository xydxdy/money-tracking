import { listReimbursables } from '@/app/actions/reimbursements';
import { formatMoney, toCents } from '@/lib/money';
import { ReimbursementRow } from '@/components/reimbursement-row';

export default async function ReimbursementsPage() {
  const items = await listReimbursables();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reimbursements</h1>
      <div className="rounded-lg border divide-y">
        {items.map((t) => (
          <ReimbursementRow key={t.id} id={t.id} details={t.details} payDate={t.payDate}
            amountLabel={formatMoney(toCents(t.amount), t.currency)} status={t.reimbursementStatus ?? 'to_claim'} />
        ))}
        {items.length === 0 && <p className="p-4 text-sm text-muted-foreground">No reimbursable transactions.</p>}
      </div>
    </div>
  );
}
