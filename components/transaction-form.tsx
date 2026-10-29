'use client';
import { useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownLeftIcon, ArrowLeftRightIcon, ArrowUpDownIcon, ArrowUpRightIcon, ChevronRightIcon, CircleCheckIcon, HandCoinsIcon,
} from 'lucide-react';
import { createTransaction, updateTransaction, deleteTransaction } from '@/app/actions/transactions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ConfirmButton } from '@/components/confirm-button';
import { DatePicker, todayIso } from '@/components/date-picker';
import { CurrencySelect } from '@/components/currency-select';
import { AccountPicker } from '@/components/account-picker';
import { CategoryChips } from '@/components/category-chips';
import type { Account, AccountGroup, Category, Transaction } from '@/db/schema';
import { sortByGroup } from '@/lib/account-groups';
import { currencySymbol } from '@/lib/currencies';
import { formatDate } from '@/lib/dates';
import { formatMoney, sanitizeAmount, toCents } from '@/lib/money';

const TYPES = ['expense', 'income', 'transfer', 'loan'] as const;
type TxType = (typeof TYPES)[number];
const TYPE_STYLE: Record<TxType, { label: string; icon: typeof ArrowUpRightIcon; text: string; tint: string }> = {
  expense: { label: 'Expense', icon: ArrowUpRightIcon, text: 'text-destructive', tint: 'from-destructive/10' },
  income: { label: 'Income', icon: ArrowDownLeftIcon, text: 'text-positive', tint: 'from-positive/10' },
  transfer: { label: 'Transfer', icon: ArrowLeftRightIcon, text: 'text-primary', tint: 'from-primary/10' },
  loan: { label: 'Loan', icon: HandCoinsIcon, text: 'text-amber-600 dark:text-amber-400', tint: 'from-amber-500/10' },
};
const LOAN_KINDS = [
  { value: 'lend', label: 'I lent', hint: 'Money leaves your account to them' },
  { value: 'borrow', label: 'I borrowed', hint: 'Money arrives in your account from them' },
  { value: 'repayment_in', label: 'They repaid me', hint: 'Money arrives in your account' },
  { value: 'repayment_out', label: 'I repaid them', hint: 'Money leaves your account' },
] as const;
type LoanKind = (typeof LOAN_KINDS)[number]['value'];

// The server action throws a bare `Error('FORBIDDEN')`/`Error('NOT_FOUND')` for ownership
// failures, and a `ZodError` (from `.parse()`) for anything that fails the per-type schema —
// including the case this form is specifically built to surface: switching `type` on an
// existing transaction to one whose required account/category field isn't filled in, which
// `updateTransaction`'s full-record revalidation (see app/actions/transactions.ts) rejects.
//
// A thrown error crossing the Server Action boundary does NOT arrive as a real `ZodError`
// instance on the client — `instanceof ZodError` is always false here, confirmed by inspecting
// the actual RSC payload during manual QA. It arrives as a plain object with `name: "ZodError"`
// and `message` equal to ZodError's own `JSON.stringify(issues)` string, so the issue list has
// to be recovered by parsing `.message` rather than by reading `.issues` off the error.
function describeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === 'FORBIDDEN') return 'One of the selected accounts or categories is not valid.';
    if (err.message === 'NOT_FOUND') return 'This transaction no longer exists.';
    if (err.message === 'TO_AMOUNT_REQUIRED') return 'Enter the amount received in the destination account\'s currency.';
    if ((err as { name?: string }).name === 'ZodError') {
      try {
        const issues = JSON.parse(err.message) as Array<{ message?: string }>;
        if (issues[0]?.message) return issues[0].message;
      } catch {
        // fall through to the generic message below
      }
    }
  }
  return 'Could not save transaction. Check that the account/category are valid.';
}


const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;

function shiftDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends string>({ label, options, value, onChange }: {
  label: string; options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${value === o.value ? 'bg-card font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function TransactionForm({
  accounts, groups = [], balances, categories, existing, people = [], initialType = 'expense', initialAccountId, returnTo,
}: {
  accounts: Account[]; groups?: AccountGroup[]; categories: Category[]; existing?: Transaction; people?: string[]; initialType?: TxType;
  /** Current balance per account id, in cents, shown in the account pickers. */
  balances?: Record<string, number>;
  /** Pre-selects this account (e.g. when adding from an account's page); `returnTo` is where to go after saving. */
  initialAccountId?: string; returnTo?: string;
}) {
  const router = useRouter();
  const amountRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<TxType>(existing?.type ?? initialType);
  const [amount, setAmount] = useState(existing?.amount ?? '');
  const [details, setDetails] = useState(existing?.details ?? '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? '');
  const [payDate, setPayDate] = useState(existing?.payDate ?? todayIso());
  // Bumped to reset the uncontrolled date field after a quick pick, and the other uncontrolled
  // fields after "Save & add another".
  const [dateKey, setDateKey] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [reimbursable, setReimbursable] = useState(existing?.reimbursable ?? false);
  const [moreOpen, setMoreOpen] = useState(!!(existing?.note || existing?.link || existing?.reimbursable));
  // A pre-selected account fills both sides; only the side the chosen type shows gets submitted.
  const [fromAccountId, setFromAccountId] = useState(existing ? existing.fromAccountId ?? '' : initialAccountId ?? '');
  const [toAccountId, setToAccountId] = useState(existing ? existing.toAccountId ?? '' : initialAccountId ?? '');
  const [loanKind, setLoanKind] = useState<LoanKind>(existing?.loanKind ?? 'lend');
  const isLoan = type === 'loan';
  // An expense can be paid by a person instead of from an account (and an income received by a
  // person) — e.g. a friend paying for you, which you then owe them.
  const [via, setVia] = useState<'account' | 'person'>(
    existing && ((existing.type === 'expense' && !existing.fromAccountId) || (existing.type === 'income' && !existing.toAccountId)) && existing.counterparty
      ? 'person' : 'account');
  const viaPerson = (type === 'expense' || type === 'income') && via === 'person';
  // Which account the money moves through: out of `from` (expense, transfer, lending, paying
  // back) and/or into `to` (income, transfer, borrowing, being paid back).
  const loanMovesIn = loanKind === 'borrow' || loanKind === 'repayment_in';
  const showFrom = (type === 'expense' && !viaPerson) || type === 'transfer' || (isLoan && !loanMovesIn);
  const showTo = (type === 'income' && !viaPerson) || type === 'transfer' || (isLoan && loanMovesIn);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Switching a loan between money-out (lent / repaid them) and money-in (borrowed / repaid me)
  // moves the chosen account to the other side instead of making the user pick it again.
  function onLoanKindChange(next: LoanKind) {
    const nextIn = next === 'borrow' || next === 'repayment_in';
    if (nextIn && !loanMovesIn && fromAccountId && !toAccountId) { setToAccountId(fromAccountId); setFromAccountId(''); }
    if (!nextIn && loanMovesIn && toAccountId && !fromAccountId) { setFromAccountId(toAccountId); setToAccountId(''); }
    setLoanKind(next);
  }

  function onTypeChange(next: TxType) {
    // A transfer can't go from an account to itself, so drop the duplicate pre-selected destination.
    if (next === 'transfer' && fromAccountId && fromAccountId === toAccountId) setToAccountId('');
    // Categories belong to one type; keep the original only when switching back to it.
    setCategoryId(existing?.type === next ? existing.categoryId ?? '' : '');
    setType(next);
  }

  function swapAccounts() {
    setFromAccountId(toAccountId);
    setToAccountId(fromAccountId);
  }

  function pickDate(iso: string) {
    setPayDate(iso);
    setDateKey((k) => k + 1);
  }

  const currencyOf = (id: string) => accounts.find((a) => a.id === id)?.currency;
  const fromCurrency = currencyOf(fromAccountId);
  const toCurrency = currencyOf(toAccountId);
  // "To amount" is the amount that lands in the destination account, so it only exists when a
  // transfer crosses currencies; for a same-currency transfer the amount is the same on both sides.
  const showToAmount = type === 'transfer' && !!fromCurrency && !!toCurrency && fromCurrency !== toCurrency;
  // The currency is never typed: it is the currency of the account the money leaves (or, for
  // income, arrives in). The server derives it the same way.
  const currency = viaPerson ? undefined : type === 'income' || (isLoan && loanMovesIn) ? toCurrency : fromCurrency;

  // Every category of this transaction's type, sorted by name (from listCategories). Archived
  // ones are hidden unless this transaction already uses it.
  const relevantCategories = categories.filter((c) => c.type === type && (!c.archived || c.id === existing?.categoryId));
  // Archived accounts are hidden from the pickers unless this transaction already uses one.
  // Sorted by group (in the order shown on the Accounts page), favourites first within each group.
  const pickable = sortByGroup(
    accounts.filter((a) => !a.archived || a.id === existing?.fromAccountId || a.id === existing?.toAccountId), groups);
  const pickerProps = { accounts: pickable, groups, balances };

  const today = todayIso();
  const yesterday = shiftDays(today, -1);
  const style = TYPE_STYLE[type];

  // One-line recap for the save bar, e.g. "Expense · ฿120.00 from KBANK".
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name;
  const amountLabel = AMOUNT_RE.test(amount) && currency ? formatMoney(toCents(amount), currency) : amount || null;
  const route = type === 'transfer'
    ? [accountName(fromAccountId), accountName(toAccountId)].filter(Boolean).join(' → ')
    : showFrom ? (accountName(fromAccountId) && `from ${accountName(fromAccountId)}`)
      : showTo ? (accountName(toAccountId) && `to ${accountName(toAccountId)}`) : null;
  const summary = [style.label, [amountLabel, route].filter(Boolean).join(' ')].filter(Boolean).join(' · ');

  async function onSubmit(formData: FormData) {
    if (!formData.get('payDate')) {
      setError('Enter the date as DD/MM/YYYY.');
      return;
    }
    if (showFrom && !fromAccountId) { setError(`Choose the account the money ${type === 'transfer' ? 'leaves' : 'comes from'}.`); return; }
    if (showTo && !toAccountId) { setError(`Choose the account the money ${type === 'transfer' ? 'goes to' : 'arrives in'}.`); return; }
    const addAnother = !existing && formData.get('intent') === 'another';
    setPending(true);
    setError(null);
    setSaved(null);
    const payload = {
      type,
      details: details.trim(),
      payDate: String(formData.get('payDate')),
      amount: amount.trim(),
      categoryId: isLoan ? undefined : categoryId || undefined,
      fromAccountId: String(formData.get('fromAccountId') || '') || undefined,
      toAccountId: String(formData.get('toAccountId') || '') || undefined,
      toAmount: showToAmount ? String(formData.get('toAmount') || '') || undefined : undefined,
      note: String(formData.get('note') || '') || undefined,
      link: String(formData.get('link') || '').trim() || undefined,
      reimbursable: isLoan ? false : reimbursable,
      ...(isLoan ? { loanKind, counterparty: String(formData.get('counterparty') || '').trim() } : {}),
      ...(viaPerson ? {
        counterparty: String(formData.get('counterparty') || '').trim(),
        currency: String(formData.get('currency') || ''),
        ...(type === 'expense' ? { fromAccountId: undefined } : { toAccountId: undefined }),
      } : {}),
    } as Parameters<typeof createTransaction>[0];

    try {
      // On edit, a blanked optional field must be sent as null so the server clears it;
      // undefined would mean "leave unchanged".
      if (existing) await updateTransaction(existing.id, {
        ...payload,
        categoryId: payload.categoryId ?? null,
        toAmount: payload.toAmount ?? null,
        note: payload.note ?? null,
        link: payload.link ?? null,
        ...(viaPerson ? (type === 'expense' ? { fromAccountId: null } : { toAccountId: null }) : {}),
      });
      else await createTransaction(payload);
      if (addAnother) {
        // Keep the type, accounts and date; clear what's specific to the one just saved.
        setSaved(`Saved “${payload.details}”${amountLabel ? ` · ${amountLabel}` : ''}. Add the next one.`);
        setAmount('');
        setDetails('');
        setCategoryId('');
        setReimbursable(false);
        setResetKey((k) => k + 1);
        router.refresh();
        amountRef.current?.focus();
        return;
      }
      router.push(existing ? `/transactions/${existing.id}` : returnTo ?? (isLoan ? '/loans' : '/transactions'));
      router.refresh();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-4">
      {saved && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-positive/30 bg-positive/10 px-4 py-2.5 text-sm text-positive">
          <CircleCheckIcon className="size-4 shrink-0" /> {saved}
        </p>
      )}

      {/* What & how much */}
      <section className={`space-y-5 rounded-xl border bg-gradient-to-b ${style.tint} to-card to-60% p-4 shadow-xs`}>
        <div role="radiogroup" aria-label="Type" className="grid grid-cols-4 gap-1 rounded-lg bg-muted/80 p-1">
          {TYPES.map((t) => {
            const { label, icon: Icon, text } = TYPE_STYLE[t];
            return (
              <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => onTypeChange(t)}
                className={`flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-xs font-medium transition-colors sm:flex-row sm:justify-center sm:gap-1.5 sm:text-sm ${type === t
                  ? `bg-card shadow-xs ${text}` : 'text-muted-foreground hover:text-foreground'}`}>
                <Icon className="size-4" /> {label}
              </button>
            );
          })}
        </div>

        <div className="space-y-1 text-center">
          <Label htmlFor="amount" className="justify-center text-xs font-normal text-muted-foreground">
            {showToAmount ? `Amount sent (${fromCurrency})` : 'Amount'}
          </Label>
          <div className="flex items-baseline justify-center gap-1.5">
            {currency && <span className={`text-2xl font-medium ${style.text} opacity-70`}>{currencySymbol(currency)}</span>}
            <input
              ref={amountRef}
              id="amount"
              name="amount"
              value={amount}
              onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
              required
              inputMode="decimal"
              autoComplete="off"
              autoFocus={!existing}
              placeholder="0.00"
              aria-invalid={amount !== '' && !AMOUNT_RE.test(amount)}
              className={`field-sizing-content min-w-[4ch] max-w-full bg-transparent text-center text-5xl font-semibold tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/40 aria-invalid:text-destructive ${style.text}`}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {currency ? currency : viaPerson ? 'Pick the currency below' : 'The currency comes from the account'}
          </p>
        </div>

        {showToAmount && (
          <div key={`to-${resetKey}`} className="mx-auto max-w-xs space-y-1 text-center">
            <Label htmlFor="toAmount" className="justify-center text-xs font-normal text-muted-foreground">Amount received ({toCurrency})</Label>
            <div className="flex items-baseline justify-center gap-1.5">
              <span className="text-lg text-muted-foreground">{currencySymbol(toCurrency!)}</span>
              <input id="toAmount" name="toAmount" defaultValue={existing?.toAmount ?? undefined} required inputMode="decimal"
                onInput={(e) => { e.currentTarget.value = sanitizeAmount(e.currentTarget.value); }} autoComplete="off" placeholder="0.00"
                className="field-sizing-content min-w-[4ch] bg-transparent text-center text-2xl font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40" />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="details" className="sr-only">Details</Label>
          <Input id="details" name="details" value={details} onChange={(e) => setDetails(e.target.value)} required
            placeholder={type === 'income' ? 'What is it from? e.g. Salary' : type === 'transfer' ? 'What is it for? e.g. Top up savings' : isLoan ? 'What is it for? e.g. Dinner' : 'What was it? e.g. Coffee'}
            className="h-11 bg-background text-base" autoComplete="off" />
        </div>
      </section>

      {/* Where the money moves */}
      <Section title={isLoan ? 'Loan' : type === 'transfer' ? 'Accounts' : type === 'expense' ? 'Paid from' : 'Received in'}>
        {isLoan && (
          <div key={`loan-${resetKey}`} className="space-y-3">
            <div role="radiogroup" aria-label="Loan kind" className="grid grid-cols-2 gap-2">
              {LOAN_KINDS.map((k) => (
                <button key={k.value} type="button" role="radio" aria-checked={loanKind === k.value} onClick={() => onLoanKindChange(k.value)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${loanKind === k.value ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500' : 'bg-background hover:bg-accent'}`}>
                  <span className="block font-medium">{k.label}</span>
                  <span className="block text-xs text-muted-foreground">{k.hint}</span>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="counterparty">Person</Label>
              <Input id="counterparty" name="counterparty" list="loan-people" required maxLength={80}
                defaultValue={existing?.counterparty ?? undefined} placeholder="Who is the loan with?" autoComplete="off" />
              <datalist id="loan-people">{people.map((p) => <option key={p} value={p} />)}</datalist>
            </div>
          </div>
        )}

        {(type === 'expense' || type === 'income') && (
          <Segmented
            label={type === 'expense' ? 'Paid from' : 'Received in'}
            value={via}
            onChange={setVia}
            options={[
              { value: 'account', label: 'My account' },
              { value: 'person', label: type === 'expense' ? 'Someone paid' : 'Someone received' },
            ]}
          />
        )}

        {viaPerson && (
          <div key={`person-${resetKey}`} className="grid gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="counterparty">{type === 'expense' ? 'Who paid for you?' : 'Who received it?'}</Label>
              <Input id="counterparty" name="counterparty" list="loan-people" required maxLength={80}
                defaultValue={existing?.counterparty ?? undefined} placeholder="Name" autoComplete="off" />
              <datalist id="loan-people">{people.map((p) => <option key={p} value={p} />)}</datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <CurrencySelect id="currency" name="currency" defaultValue={existing?.currency ?? accounts[0]?.currency ?? 'USD'} className="sm:w-44" />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              {type === 'expense' ? 'Counts as your spending and adds to what you owe them on the Loans page. No account balance changes.' : 'Reduces what you owe them on the Loans page. No account balance changes.'}
            </p>
          </div>
        )}

        {showFrom && (
          <div className="space-y-1.5">
            {(type === 'transfer' || isLoan) && <Label htmlFor="fromAccountId">{isLoan ? 'From account (money leaves)' : 'From'}</Label>}
            <AccountPicker id="fromAccountId" name="fromAccountId" label={type === 'transfer' ? 'From account' : isLoan ? 'From account' : 'Paid from'}
              value={fromAccountId} onChange={setFromAccountId} disabledId={type === 'transfer' ? toAccountId : undefined} {...pickerProps} />
          </div>
        )}

        {type === 'transfer' && (
          <div className="flex justify-center">
            <Button type="button" variant="outline" size="sm" onClick={swapAccounts} disabled={!fromAccountId && !toAccountId} aria-label="Swap from and to accounts">
              <ArrowUpDownIcon /> Swap
            </Button>
          </div>
        )}

        {showTo && (
          <div className="space-y-1.5">
            {(type === 'transfer' || isLoan) && <Label htmlFor="toAccountId">{isLoan ? 'To account (money arrives)' : 'To'}</Label>}
            <AccountPicker id="toAccountId" name="toAccountId" label={type === 'transfer' ? 'To account' : isLoan ? 'To account' : 'Received in'}
              value={toAccountId} onChange={setToAccountId} disabledId={type === 'transfer' ? fromAccountId : undefined} {...pickerProps} />
          </div>
        )}
      </Section>

      {!isLoan && (
        <Section title="Category" aside={categoryId ? <button type="button" onClick={() => setCategoryId('')} className="text-xs text-muted-foreground hover:text-foreground">Clear</button> : undefined}>
          <CategoryChips name="categoryId" categories={relevantCategories} value={categoryId} onChange={setCategoryId} />
        </Section>
      )}

      <Section title="Date" aside={<span className="text-xs text-muted-foreground">{payDate ? formatDate(payDate) : ''}</span>}>
        <div className="flex flex-wrap items-center gap-2">
          {[{ iso: today, label: 'Today' }, { iso: yesterday, label: 'Yesterday' }].map((d) => (
            <button key={d.label} type="button" onClick={() => pickDate(d.iso)} aria-pressed={payDate === d.iso}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${payDate === d.iso ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}`}>
              {d.label}
            </button>
          ))}
          <div className="min-w-44 flex-1 sm:max-w-56">
            <DatePicker key={dateKey} id="payDate" name="payDate" defaultValue={payDate} onChange={setPayDate} />
          </div>
        </div>
      </Section>

      {/* Optional extras, folded away unless used */}
      <section className="rounded-xl border bg-card shadow-xs">
        <button type="button" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} aria-controls="more-options"
          className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronRightIcon className={`size-4 transition-transform ${moreOpen ? 'rotate-90' : ''}`} />
          More options
          <span className="font-normal">· note, receipt link{isLoan ? '' : ', reimbursable'}</span>
          {!moreOpen && reimbursable && <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Reimbursable</span>}
        </button>
        {/* Kept mounted while closed so typed values are still submitted. */}
        <div key={`more-${resetKey}`} id="more-options" hidden={!moreOpen} className="space-y-4 border-t px-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Input id="note" name="note" defaultValue={existing?.note ?? undefined} autoComplete="off" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="link">Receipt link</Label>
            <Input id="link" name="link" type="url" inputMode="url" placeholder="https://…" defaultValue={existing?.link ?? undefined} />
          </div>
          {!isLoan && (
            <Label className="flex items-center gap-2 font-normal">
              <Switch checked={reimbursable} onCheckedChange={setReimbursable} />
              Reimbursable — track it on the Reimbursements page
            </Label>
          )}
        </div>
      </section>

      {/* Save bar: stays in view at the bottom of the screen */}
      <div className="sticky bottom-0 z-20 -mx-4 space-y-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border md:shadow-sm">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground" aria-live="polite">{summary}</p>
          {existing && (
            <>
              <ConfirmButton
                label="Delete"
                description={`Delete "${existing.details}"? This cannot be undone.`}
                confirmText={existing.details}
                onConfirm={() => deleteTransaction(existing.id)}
                redirectTo="/transactions"
              />
              <Button type="button" variant="outline" disabled={pending} onClick={() => router.push(`/transactions/${existing.id}`)}>Cancel</Button>
            </>
          )}
          {!existing && (
            <Button type="submit" name="intent" value="another" variant="outline" disabled={pending}>Save &amp; add another</Button>
          )}
          <Button type="submit" name="intent" value="save" disabled={pending}>{pending ? 'Saving…' : existing ? 'Save changes' : 'Save'}</Button>
        </div>
      </div>
    </form>
  );
}
