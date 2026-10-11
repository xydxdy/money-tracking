import Link from 'next/link';
import { ReceiptIcon } from 'lucide-react';
import { listReimbursables } from '@/app/actions/reimbursements';
import { listAccounts } from '@/app/actions/accounts';
import { listCategories } from '@/app/actions/categories';
import { formatMoney, toCents } from '@/lib/money';
import { parseTransactionFilters, TRANSACTION_SORTS } from '@/lib/transaction-query';
import { REIMBURSEMENT_LABELS, REIMBURSEMENT_STATUSES, summarizeReimbursements, type ReimbursementStatus } from '@/lib/reimbursements';
import { clampPage, totalPages } from '@/lib/pagination';
import { ReimbursementRow, STATUS_TONES } from '@/components/reimbursement-row';
import { ListToolbar } from '@/components/list-toolbar';
import { PageHeader } from '@/components/page-header';
import { Pagination } from '@/components/pagination';

const PAGE_SIZE = 25;

function Totals({ totals }: { totals: Record<string, number> }) {
  const entries = Object.entries(totals).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return <p className="text-xl font-semibold tabular-nums text-muted-foreground">—</p>;
  return (
    <div className="space-y-0.5">
      {entries.map(([currency, cents]) => (
        <p key={currency} className="text-xl font-semibold tracking-tight tabular-nums">{formatMoney(cents, currency)}</p>
      ))}
    </div>
  );
}

export default async function ReimbursementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = parseTransactionFilters(params);
  const requestedPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const [all, items, accounts, categories] = await Promise.all([
    listReimbursables({}),
    listReimbursables(filters),
    listAccounts(),
    listCategories(),
  ]);
  const summary = summarizeReimbursements(all);

  const pageCount = totalPages(items.length, PAGE_SIZE);
  const page = clampPage(requestedPage, pageCount);
  const rows = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = Object.entries(filters).some(([k, v]) => k !== 'sort' && k !== 'status' && v);

  // Tab and page links keep search/date/sort and change only the status or page.
  const hrefWith = (changes: { status?: string; page?: number }) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v && k !== 'status') q.set(k, String(v));
    const status = 'status' in changes ? changes.status : filters.status;
    if (status) q.set('status', status);
    if (changes.page && changes.page > 1) q.set('page', String(changes.page));
    const qs = q.toString();
    return qs ? `/reimbursements?${qs}` : '/reimbursements';
  };
  const meta = (t: (typeof rows)[number]) => {
    const account = accounts.find((a) => a.id === (t.fromAccountId ?? t.toAccountId));
    const category = categories.find((c) => c.id === t.categoryId);
    return [category?.name, account?.name ?? (t.counterparty ? `Paid by ${t.counterparty}` : null)].filter(Boolean).join(' · ');
  };
  const tabs: { key?: ReimbursementStatus; label: string; count: number }[] = [
    { label: 'All', count: summary.all.count },
    ...REIMBURSEMENT_STATUSES.map((s) => ({ key: s, label: REIMBURSEMENT_LABELS[s], count: summary[s].count })),
  ];

  return (
    <>
      <PageHeader title="Reimbursements" description="Track expenses you'll be paid back for: To claim → Submitting → Claimed (or Denied)." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {REIMBURSEMENT_STATUSES.map((s) => (
          <Link key={s} href={hrefWith({ status: s })}
            className={`rounded-xl border bg-card p-4 shadow-xs transition-shadow hover:shadow-md ${filters.status === s ? 'ring-2 ring-primary' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONES[s]}`}>{REIMBURSEMENT_LABELS[s]}</span>
              <span className="text-sm text-muted-foreground">{summary[s].count} {summary[s].count === 1 ? 'item' : 'items'}</span>
            </div>
            <div className="mt-3"><Totals totals={summary[s].totals} /></div>
            <p className="mt-1 text-xs text-muted-foreground">
              {s === 'to_claim' ? 'Not claimed yet' : s === 'submitting' ? 'Claimed, waiting to be paid' : s === 'claimed' ? 'Paid back' : 'Rejected, won’t be paid'}
            </p>
          </Link>
        ))}
      </div>

      <nav className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" aria-label="Status">
        {tabs.map((t) => {
          const active = (filters.status ?? undefined) === t.key;
          return (
            <Link key={t.label} href={hrefWith({ status: t.key })} aria-current={active ? 'page' : undefined}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${active ? 'bg-card font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.label} <span className="text-xs text-muted-foreground">({t.count})</span>
            </Link>
          );
        })}
      </nav>

      <ListToolbar
        values={{ q: filters.q, status: filters.status, from: filters.from, to: filters.to, sort: filters.sort }}
        sorts={TRANSACTION_SORTS}
        selects={[]}
      />

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          <ReceiptIcon className="mx-auto mb-2 size-6" />
          {hasFilters || filters.status
            ? 'No reimbursements match these filters.'
            : 'No reimbursable transactions yet. Turn on “Reimbursable” when adding an expense to track it here.'}
        </div>
      ) : (
        <div className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
          {rows.map((t) => (
            <ReimbursementRow
              key={`${t.id}-${t.reimbursementStatus}`}
              id={t.id}
              details={t.details}
              payDate={t.payDate}
              amountLabel={formatMoney(toCents(t.amount), t.currency)}
              status={t.reimbursementStatus ?? 'to_claim'}
              link={t.link}
              categoryIcon={categories.find((c) => c.id === t.categoryId)?.icon}
              meta={meta(t)}
            />
          ))}
        </div>
      )}
      <Pagination page={page} pageCount={pageCount} hrefFor={(p) => hrefWith({ page: p })}
        summary={items.length > PAGE_SIZE ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + rows.length} of ${items.length}` : undefined} />
    </>
  );
}
