import { listReimbursables } from '@/app/actions/reimbursements';
import { formatMoney, toCents } from '@/lib/money';
import { parseTransactionFilters, TRANSACTION_SORTS } from '@/lib/transaction-query';
import { ReimbursementRow } from '@/components/reimbursement-row';
import { ListToolbar } from '@/components/list-toolbar';
import { PageHeader } from '@/components/page-header';

export default async function ReimbursementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseTransactionFilters(await searchParams);
  const items = await listReimbursables(filters);
  const hasFilters = Object.entries(filters).some(([k, v]) => k !== 'sort' && v);

  return (
    <>
      <PageHeader title="Reimbursements" description={`${items.length} ${items.length === 1 ? 'item' : 'items'} · To claim → Submitting → Claimed`} />
      <ListToolbar
        values={{ q: filters.q, status: filters.status, from: filters.from, to: filters.to, sort: filters.sort }}
        sorts={TRANSACTION_SORTS}
        selects={[
          { key: 'status', label: 'Statuses', options: [{ value: 'to_claim', label: 'To claim' }, { value: 'submitting', label: 'Submitting' }, { value: 'claimed', label: 'Claimed' }] },
        ]}
      />
      <div className="overflow-hidden rounded-xl border bg-card shadow-xs divide-y">
        {items.map((t) => (
          <ReimbursementRow key={`${t.id}-${t.reimbursementStatus}`} id={t.id} details={t.details} payDate={t.payDate}
            amountLabel={formatMoney(toCents(t.amount), t.currency)} status={t.reimbursementStatus ?? 'to_claim'} link={t.link} />
        ))}
        {items.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">{hasFilters ? 'No reimbursements match these filters.' : 'No reimbursable transactions.'}</p>
        )}
      </div>
    </>
  );
}
