'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTransaction, updateTransaction, deleteTransaction } from '@/app/actions/transactions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ConfirmButton } from '@/components/confirm-button';
import { DatePicker, todayIso } from '@/components/date-picker';
import { CurrencySelect } from '@/components/currency-select';
import { IconLabel } from '@/components/app-icon';
import type { Account, Category, Transaction } from '@/db/schema';

const TYPES = ['expense', 'income', 'transfer', 'loan'] as const;
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

export function TransactionForm({
  accounts, categories, existing, people = [], initialType = 'expense', initialAccountId, returnTo,
}: {
  accounts: Account[]; categories: Category[]; existing?: Transaction; people?: string[]; initialType?: (typeof TYPES)[number];
  /** Pre-selects this account (e.g. when adding from an account's page); `returnTo` is where to go after saving. */
  initialAccountId?: string; returnTo?: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<(typeof TYPES)[number]>(existing?.type ?? initialType);
  const [reimbursable, setReimbursable] = useState(existing?.reimbursable ?? false);
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

  // Switching a loan between money-out (lent / repaid them) and money-in (borrowed / repaid me)
  // moves the chosen account to the other side instead of making the user pick it again.
  function onLoanKindChange(next: LoanKind) {
    const nextIn = next === 'borrow' || next === 'repayment_in';
    if (nextIn && !loanMovesIn && fromAccountId && !toAccountId) { setToAccountId(fromAccountId); setFromAccountId(''); }
    if (!nextIn && loanMovesIn && toAccountId && !fromAccountId) { setFromAccountId(toAccountId); setToAccountId(''); }
    setLoanKind(next);
  }

  // A transfer can't go from an account to itself, so drop the duplicate pre-selected destination.
  function onTypeChange(next: (typeof TYPES)[number]) {
    if (next === 'transfer' && fromAccountId && fromAccountId === toAccountId) setToAccountId('');
    setType(next);
  }

  const currencyOf = (id: string) => accounts.find((a) => a.id === id)?.currency;
  const fromCurrency = currencyOf(fromAccountId);
  const toCurrency = currencyOf(toAccountId);
  // "To amount" is the amount that lands in the destination account, so it only exists when a
  // transfer crosses currencies; for a same-currency transfer the amount is the same on both sides.
  const showToAmount = type === 'transfer' && !!fromCurrency && !!toCurrency && fromCurrency !== toCurrency;

  // The currency is never typed: it is the currency of the account the money leaves (or, for
  // income, arrives in). The server derives it the same way.
  const currency = type === 'income' || (isLoan && loanMovesIn) ? toCurrency : fromCurrency;
  const onFromAccountChange = (id: string | null) => setFromAccountId(id ?? '');
  const onToAccountChange = (id: string | null) => setToAccountId(id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Every category of this transaction's type, sorted by name (from listCategories). Archived
  // ones are hidden unless this transaction already uses it.
  const relevantCategories = categories.filter(
    (c) => c.type === type && (!c.archived || c.id === existing?.categoryId)
  );
  // Once the user switches type away from the transaction's original type, the original
  // categoryId (scoped to the original type) won't appear in `relevantCategories` — defaulting
  // the select to it would show a value that isn't one of the rendered options.
  const categoryDefault = existing?.type === type ? (existing?.categoryId ?? undefined) : undefined;

  // This Base UI Select is documented (not a Radix carryover) to render the raw `value` in its
  // trigger unless `items` is supplied — see node_modules/@base-ui/react/docs/react/components/select.md
  // ("By default, the <Select.Value> component renders the raw value... Passing the items prop
  // ... renders the matching label"). It's invisible everywhere else in this codebase because
  // every other Select's item value already equals its own label (account "type" like 'bank',
  // category "type" like 'expense'). Here `value` is the account/category *id* and the label is
  // its *name*, so without `items` the trigger displays a raw UUID instead of "Checking" —
  // confirmed live in manual QA. `items` as a value->label record fixes the trigger's text; it
  // does not change how the popup's own `<SelectItem>` list is rendered.
  // Archived accounts are hidden from the pickers unless this transaction already uses one.
  const pickable = accounts.filter((a) => !a.archived || a.id === existing?.fromAccountId || a.id === existing?.toAccountId);
  const accountItems = Object.fromEntries(pickable.map((a) => [a.id, <IconLabel key={a.id} icon={a.icon} fallback="landmark">{a.name} ({a.currency})</IconLabel>]));
  const categoryItems = Object.fromEntries(
    relevantCategories.map((c) => [c.id, <IconLabel key={c.id} icon={c.icon}>{c.name}</IconLabel>])
  );

  async function onSubmit(formData: FormData) {
    if (!formData.get('payDate')) {
      setError('Enter the date as DD/MM/YYYY.');
      return;
    }
    setPending(true);
    setError(null);
    const payload = {
      type,
      details: String(formData.get('details')),
      payDate: String(formData.get('payDate')),
      amount: String(formData.get('amount')),
      categoryId: String(formData.get('categoryId') || '') || undefined,
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
      router.push(existing ? `/transactions/${existing.id}` : returnTo ?? (isLoan ? '/loans' : '/transactions'));
      router.refresh();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-5 rounded-xl border bg-card p-5 shadow-xs">
      <div role="radiogroup" aria-label="Type" className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => onTypeChange(t)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${type === t
              ? `bg-card shadow-xs ${t === 'expense' ? 'text-destructive' : t === 'income' ? 'text-positive' : t === 'loan' ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`
              : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="details">Details</Label>
        <Input id="details" name="details" defaultValue={existing?.details} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="link">Link (receipt URL, optional)</Label>
        <Input id="link" name="link" type="url" inputMode="url" placeholder="https://…" defaultValue={existing?.link ?? undefined} />
      </div>

      {isLoan && (
        <div className="space-y-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="space-y-2">
            <Label>Loan</Label>
            <div role="radiogroup" aria-label="Loan kind" className="grid grid-cols-2 gap-2">
              {LOAN_KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  role="radio"
                  aria-checked={loanKind === k.value}
                  onClick={() => onLoanKindChange(k.value)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${loanKind === k.value ? 'border-primary bg-card ring-1 ring-primary' : 'bg-card/60 hover:bg-card'}`}
                >
                  <span className="block font-medium">{k.label}</span>
                  <span className="block text-xs text-muted-foreground">{k.hint}</span>
                </button>
              ))}
            </div>
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
        <div className="space-y-2">
          <Label>{type === 'expense' ? 'Paid from' : 'Received in'}</Label>
          <div role="radiogroup" aria-label={type === 'expense' ? 'Paid from' : 'Received in'} className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:w-80">
            {(['account', 'person'] as const).map((v) => (
              <button key={v} type="button" role="radio" aria-checked={via === v} onClick={() => setVia(v)}
                className={`rounded-md px-3 py-1 text-sm transition-colors ${via === v ? 'bg-card font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}>
                {v === 'account' ? 'My account' : type === 'expense' ? 'Someone paid' : 'Someone received'}
              </button>
            ))}
          </div>
          {viaPerson && (
            <div className="grid gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 sm:grid-cols-[1fr_auto]">
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
        </div>
      )}

      {showFrom && (
        <div className="space-y-2">
          <Label htmlFor="fromAccountId">{isLoan ? 'From account (money leaves)' : 'From account'}</Label>
          <Select name="fromAccountId" items={accountItems} value={fromAccountId || null} onValueChange={onFromAccountChange}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="max-h-[min(18rem,var(--available-height))]">{pickable.map((a) => <SelectItem key={a.id} value={a.id}><IconLabel icon={a.icon} fallback="landmark">{a.name} ({a.currency})</IconLabel></SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {!isLoan && <div className="space-y-2">
        <Label htmlFor="categoryId">Category</Label>
        {/* `key={type}` remounts the Select when the type changes, so it drops a category id
            that belongs to the previous type instead of keeping a stale selection. */}
        <Select key={type} name="categoryId" items={categoryItems} defaultValue={categoryDefault}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="max-h-[min(18rem,var(--available-height))]">
            {relevantCategories.map((c) => <SelectItem key={c.id} value={c.id}><IconLabel icon={c.icon}>{c.name}</IconLabel></SelectItem>)}
          </SelectContent>
        </Select>
      </div>}

      {showTo && (
        <div className="space-y-2">
          <Label htmlFor="toAccountId">{isLoan ? 'To account (money arrives)' : 'To account'}</Label>
          <Select name="toAccountId" items={accountItems} value={toAccountId || null} onValueChange={onToAccountChange}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="max-h-[min(18rem,var(--available-height))]">{pickable.map((a) => <SelectItem key={a.id} value={a.id}><IconLabel icon={a.icon} fallback="landmark">{a.name} ({a.currency})</IconLabel></SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="amount">
          {showToAmount ? `Amount sent (${fromCurrency})` : currency ? `Amount (${currency})` : 'Amount'}
        </Label>
        <Input id="amount" name="amount" defaultValue={existing?.amount} required inputMode="decimal" />
        {!currency && <p className="text-xs text-muted-foreground">The currency comes from the selected account.</p>}
      </div>

      {showToAmount && (
        <div className="space-y-2">
          <Label htmlFor="toAmount">Amount received ({toCurrency})</Label>
          <Input id="toAmount" name="toAmount" defaultValue={existing?.toAmount ?? undefined} required inputMode="decimal" />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="payDate">Date</Label>
        <DatePicker id="payDate" name="payDate" defaultValue={existing?.payDate ?? todayIso()} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Note</Label>
        <Input id="note" name="note" defaultValue={existing?.note ?? undefined} />
      </div>

      {!isLoan && (
        <Label className="flex items-center gap-2">
          <Switch checked={reimbursable} onCheckedChange={setReimbursable} />
          Reimbursable
        </Label>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save transaction'}</Button>
        {existing && (
          <Button type="button" variant="outline" disabled={pending} onClick={() => router.push(`/transactions/${existing.id}`)}>Cancel</Button>
        )}
        {existing && (
          <ConfirmButton
            label="Delete"
            description={`Delete "${existing.details}"? This cannot be undone.`}
            confirmText={existing.details}
            onConfirm={() => deleteTransaction(existing.id)}
            redirectTo="/transactions"
          />
        )}
      </div>
    </form>
  );
}
