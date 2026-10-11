import Link from 'next/link';
import { listTransactionsPage } from '@/app/actions/transactions';
import { Pagination } from '@/components/pagination';
import { listAccounts } from '@/app/actions/accounts';
import { listCategories } from '@/app/actions/categories';
import { formatDate, formatMonth, shiftMonth } from '@/lib/dates';
import { parseTransactionFilters, resolveDateRange, TRANSACTION_SORTS } from '@/lib/transaction-query';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { MonthNav } from '@/components/month-nav';
import { TransactionRow } from '@/components/transaction-row';
import { ListToolbar } from '@/components/list-toolbar';

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = parseTransactionFilters(params);
  // Shows all time unless a month or explicit dates are chosen.
  const range = resolveDateRange(filters);
  const requestedPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const [result, accounts, categories] = await Promise.all([
    listTransactionsPage({ ...filters, from: range.from, to: range.to, page: requestedPage }), listAccounts(), listCategories(),
  ]);
  const transactions = result.rows;
  // Page links keep every current filter (including the month/date range) and change only the page.
  const pageHref = (page: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) q.set(k, String(v));
    if (page > 1) q.set('page', String(page));
    const qs = q.toString();
    return qs ? `/transactions?${qs}` : '/transactions';
  };
  const firstShown = (result.page - 1) * result.pageSize + 1;
  const pageSummary = result.total === 0 ? undefined
    : `Showing ${firstShown}–${firstShown + transactions.length - 1} of ${result.total}`;
  const hasFilters = Object.entries(filters).some(([k, v]) => k !== 'sort' && k !== 'month' && v);

  // Month links keep the other filters but replace any date range.
  const linkFor = (month: string) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v && k !== 'from' && k !== 'to' && k !== 'month') params.set(k, String(v));
    params.set('month', month);
    return `/transactions?${params}`;
  };
  const heading = range.month === 'all' ? 'All time' : range.month ? formatMonth(range.month) : 'Custom dates';
  const navMonth = range.month && range.month !== 'all' ? range.month : new Date().toISOString().slice(0, 7);

  // Date-sorted lists are grouped under a heading per day; other sorts stay a flat list.
  const byDate = !filters.sort || filters.sort === 'date_desc' || filters.sort === 'date_asc';
  const groups: { date: string; rows: typeof transactions }[] = [];
  for (const t of transactions) {
    const last = groups.at(-1);
    if (byDate && last?.date === t.payDate) last.rows.push(t);
    else groups.push({ date: byDate ? t.payDate : '', rows: [t] });
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        description={`${result.total} ${result.total === 1 ? 'transaction' : 'transactions'} · ${heading}`}
        actions={<Button render={<Link href="/transactions/new" />} nativeButton={false}><PlusIcon /> Add transaction</Button>}
      >
        <MonthNav
          label={heading}
          prevHref={linkFor(shiftMonth(navMonth, -1))}
          nextHref={linkFor(shiftMonth(navMonth, 1))}
          todayHref={linkFor(new Date().toISOString().slice(0, 7))}
          extra={<Button render={<Link href={linkFor('all')} />} nativeButton={false} variant={range.month === 'all' ? 'secondary' : 'ghost'} size="sm">All time</Button>}
        />
      </PageHeader>
      <ListToolbar
        values={{ q: filters.q, type: filters.type, accountId: filters.accountId, categoryId: filters.categoryId, from: filters.from, to: filters.to, month: filters.month, sort: filters.sort }}
        sorts={TRANSACTION_SORTS}
        selects={[
          { key: 'type', label: 'Types', options: [{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }, { value: 'transfer', label: 'Transfer' }, { value: 'loan', label: 'Loan' }] },
          { key: 'accountId', label: 'Accounts', options: accounts.map((a) => ({ value: a.id, label: `${a.icon ?? ''} ${a.name} (${a.currency})`.trim() })) },
          { key: 'categoryId', label: 'Categories', options: categories.map((c) => ({ value: c.id, label: c.icon ? `${c.icon} ${c.name}` : c.name })) },
        ]}
      />
      {transactions.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          {hasFilters ? 'No transactions match these filters.' : range.month === 'all' ? 'No transactions yet. Add your first one.' : `No transactions in ${heading}.`}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
          {groups.map((g, i) => (
            <div key={`${g.date}-${i}`}>
              {g.date && (
                <p className="border-b bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground">{formatDate(g.date)}</p>
              )}
              <div className="divide-y border-b last:border-b-0">
                {g.rows.map((t) => <TransactionRow key={t.id} t={t} accounts={accounts} categories={categories} showDate={!byDate} />)}
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination page={result.page} pageCount={result.pageCount} hrefFor={pageHref} summary={pageSummary} />
    </>
  );
}
