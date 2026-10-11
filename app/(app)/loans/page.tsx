import Link from 'next/link';
import { HandCoinsIcon, PlusIcon, ArrowDownLeftIcon, ArrowUpRightIcon } from 'lucide-react';
import { listLoanSummary, listLoanHistory, closeLoans, reopenLoans } from '@/app/actions/loans';
import { ConfirmButton } from '@/components/confirm-button';
import { listAccounts } from '@/app/actions/accounts';
import { listCategories } from '@/app/actions/categories';
import { formatMoney } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { clampPage, totalPages } from '@/lib/pagination';
import { Pagination } from '@/components/pagination';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { TransactionRow } from '@/components/transaction-row';
import { Button } from '@/components/ui/button';

const PEOPLE_PER_PAGE = 10;

export default async function LoansPage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const { tab: requestedTab, page: requestedPage } = await searchParams;
  const tab = requestedTab === 'closed' ? 'closed' : 'current';
  const [summary, history, accounts, categories] = await Promise.all([
    listLoanSummary(),
    listLoanHistory(),
    listAccounts(),
    listCategories(),
  ]);

  // Totals per currency — what others owe you vs what you owe.
  const totals = new Map<string, { owedToMe: number; iOwe: number }>();
  for (const s of summary) {
    const t = totals.get(s.currency) ?? { owedToMe: 0, iOwe: 0 };
    if (s.netCents > 0) t.owedToMe += s.netCents;
    else t.iOwe += -s.netCents;
    totals.set(s.currency, t);
  }
  // History: one card per person. The Current tab holds each person's open loans; the Closed tab
  // their closed groups. Each tab is paged by person.
  const peopleFor = (groups: typeof history) => {
    const out: { name: string; groups: typeof history }[] = [];
    for (const g of groups) {
      const last = out.at(-1);
      if (last && last.name.toLowerCase() === g.counterparty.toLowerCase()) last.groups.push(g);
      else out.push({ name: g.counterparty, groups: [g] });
    }
    return out;
  };
  const currentPeople = peopleFor(history.filter((g) => !g.closedAt));
  const closedPeople = peopleFor(history.filter((g) => g.closedAt));
  const tabPeople = tab === 'closed' ? closedPeople : currentPeople;
  const pageCount = totalPages(tabPeople.length, PEOPLE_PER_PAGE);
  const page = clampPage(requestedPage, pageCount);
  const people = tabPeople.slice((page - 1) * PEOPLE_PER_PAGE, page * PEOPLE_PER_PAGE);
  const tabHref = (t: 'current' | 'closed', p = 1) => `/loans?tab=${t}${p > 1 ? `&page=${p}` : ''}#history`;
  // A summary card jumps to that person's open loans on the Current tab, on whichever page they're on.
  const personHref = (name: string) => {
    const index = currentPeople.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
    const p = index < 0 ? 1 : Math.floor(index / PEOPLE_PER_PAGE) + 1;
    return `/loans?tab=current${p > 1 ? `&page=${p}` : ''}#person-${encodeURIComponent(name.toLowerCase())}`;
  };
  const reopenAction = (counterparty: string, currency: string, closedAt: string) => async () => {
    'use server';
    await reopenLoans({ counterparty, currency, closedAt });
  };

  const open = summary.filter((s) => s.netCents !== 0);
  const settled = summary.filter((s) => s.netCents === 0);

  return (
    <>
      <PageHeader
        title="Loans"
        description="Money you've lent to or borrowed from people. Loans move account balances but don't count as income or spending."
        actions={<Button render={<Link href="/transactions/new?type=loan" />} nativeButton={false}><PlusIcon /> Add loan</Button>}
      />

      {[...totals.entries()].sort().map(([currency, t]) => (
        <div key={currency} className="grid gap-4 sm:grid-cols-2">
          <StatCard label={`Owed to you · ${currency}`} tone="positive" icon={<ArrowDownLeftIcon />} value={formatMoney(t.owedToMe, currency)} />
          <StatCard label={`You owe · ${currency}`} tone="negative" icon={<ArrowUpRightIcon />} value={formatMoney(t.iOwe, currency)} />
        </div>
      ))}

      {summary.length === 0 && history.length > 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
          All loans are closed. Closed loans are still listed in the history below.
        </div>
      ) : summary.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          <HandCoinsIcon className="mx-auto mb-2 size-6" />
          No loans yet. <Link href="/transactions/new?type=loan" className="text-primary hover:underline">Add a loan</Link> to start tracking who owes whom.
        </div>
      ) : (
        <section className="space-y-3">
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">By person</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...open, ...settled].map((s) => (
              <div key={`${s.counterparty}-${s.currency}`} className="flex flex-col rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-md">
                <Link href={personHref(s.counterparty)} className="flex-1 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{s.counterparty}</span>
                    <span className="text-xs text-muted-foreground">{s.currency}</span>
                  </div>
                  <p className={`mt-2 text-xl font-semibold tabular-nums ${s.netCents > 0 ? 'text-positive' : s.netCents < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {s.netCents === 0 ? 'Settled' : formatMoney(Math.abs(s.netCents), s.currency)}
                  </p>
                  <p className="text-sm text-muted-foreground">{s.netCents > 0 ? 'owes you' : s.netCents < 0 ? 'you owe' : 'nothing outstanding'}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {s.lentCents > 0 && <><dt>Lent</dt><dd className="text-right tabular-nums">{formatMoney(s.lentCents, s.currency)}</dd></>}
                    {s.repaidToMeCents > 0 && <><dt>Repaid to you</dt><dd className="text-right tabular-nums">{formatMoney(s.repaidToMeCents, s.currency)}</dd></>}
                    {s.borrowedCents > 0 && <><dt>Borrowed</dt><dd className="text-right tabular-nums">{formatMoney(s.borrowedCents, s.currency)}</dd></>}
                    {s.repaidByMeCents > 0 && <><dt>You repaid</dt><dd className="text-right tabular-nums">{formatMoney(s.repaidByMeCents, s.currency)}</dd></>}
                  </dl>
                </Link>
                <div className="flex items-center justify-between gap-2 border-t px-4 py-2">
                  <span className="text-xs text-muted-foreground">{s.count} open {s.count === 1 ? 'loan' : 'loans'}</span>
                  <ConfirmButton
                    variant="outline"
                    label="Close"
                    confirmLabel="Close loans"
                    description={s.netCents === 0
                      ? `Close ${s.counterparty}'s ${s.currency} loans? They move to the history and a new loan starts a fresh balance.`
                      : `${s.counterparty} still has ${formatMoney(Math.abs(s.netCents), s.currency)} ${s.netCents > 0 ? 'owing to you' : 'owed by you'}. Closing removes this from the balance (e.g. if it was settled another way or written off). The loans stay in the history and can be reopened.`}
                    onConfirm={async () => { 'use server'; await closeLoans({ counterparty: s.counterparty, currency: s.currency }); }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section id="history" className="scroll-mt-20 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">History by person</h2>
            <nav className="flex gap-1 rounded-lg bg-muted p-1" aria-label="Loan history">
              {([['current', 'Current', currentPeople.length], ['closed', 'Closed', closedPeople.length]] as const).map(([key, label, n]) => (
                <Link key={key} href={tabHref(key)} aria-current={tab === key ? 'page' : undefined}
                  className={`rounded-md px-3 py-1 text-sm transition-colors ${tab === key ? 'bg-card font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}>
                  {label} <span className="text-xs text-muted-foreground">({n})</span>
                </Link>
              ))}
            </nav>
          </div>
          {people.length === 0 && (
            <div className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
              {tab === 'closed' ? 'No closed loans yet. Close a person’s loans from their card above.' : 'No open loans. Closed loans are under the Closed tab.'}
            </div>
          )}
          {people.map(({ name, groups }) => (
            <div key={name} id={`person-${encodeURIComponent(name.toLowerCase())}`} className="scroll-mt-20 overflow-hidden rounded-xl border bg-card shadow-xs">
              <div className="border-b px-4 py-3">
                <h3 className="font-medium">{name}</h3>
              </div>
              {groups.map((g) => {
                const label = g.closedAt ? `Closed ${formatDate(g.closedAt.toISOString().slice(0, 10))}` : 'Open';
                return (
                  <div key={`${g.currency}-${g.closedAt?.getTime() ?? 'open'}`} className="border-b last:border-b-0">
                    <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm ${g.closedAt ? 'bg-muted/40' : 'bg-accent/30'}`}>
                      <span className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${g.closedAt ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>{label}</span>
                        <span className="text-muted-foreground">{g.currency} · {g.transactions.length} {g.transactions.length === 1 ? 'loan' : 'loans'}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className={`tabular-nums ${g.netCents > 0 ? 'text-positive' : g.netCents < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {g.netCents === 0 ? 'Settled' : `${formatMoney(Math.abs(g.netCents), g.currency)} ${g.netCents > 0 ? 'owed to you' : 'you owed'}`}
                        </span>
                        {g.closedAt && (
                          <ConfirmButton
                            variant="outline"
                            label="Reopen"
                            confirmLabel="Reopen"
                            description={`Reopen this closed group of ${name}'s ${g.currency} loans? They join ${name}'s open loans and count towards the balance again.`}
                            onConfirm={reopenAction(name, g.currency, g.closedAt.toISOString())}
                          />
                        )}
                      </span>
                    </div>
                    <div className="divide-y">
                      {g.transactions.map((t) => (
                        <TransactionRow key={t.id} t={t} accounts={accounts} categories={categories} muted={!!g.closedAt} personContext />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <Pagination page={page} pageCount={pageCount} hrefFor={(p) => tabHref(tab, p)}
            summary={tabPeople.length > PEOPLE_PER_PAGE ? `${tabPeople.length} people` : undefined} />
        </section>
      )}
    </>
  );
}
