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
import type { Account, Category, Transaction } from '@/db/schema';

const TYPES = ['expense', 'income', 'transfer'] as const;

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
  accounts, categories, existing,
}: { accounts: Account[]; categories: Category[]; existing?: Transaction }) {
  const router = useRouter();
  const [type, setType] = useState<(typeof TYPES)[number]>(existing?.type ?? 'expense');
  const [reimbursable, setReimbursable] = useState(existing?.reimbursable ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const relevantCategories = categories.filter((c) => c.type === type);
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
  const accountItems = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const categoryItems = Object.fromEntries(
    relevantCategories.map((c) => [c.id, c.icon ? `${c.icon} ${c.name}` : c.name])
  );

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const payload = {
      type,
      details: String(formData.get('details')),
      payDate: String(formData.get('payDate')),
      amount: String(formData.get('amount')),
      currency: String(formData.get('currency')),
      categoryId: String(formData.get('categoryId') || '') || undefined,
      fromAccountId: String(formData.get('fromAccountId') || '') || undefined,
      toAccountId: String(formData.get('toAccountId') || '') || undefined,
      toAmount: String(formData.get('toAmount') || '') || undefined,
      note: String(formData.get('note') || '') || undefined,
      reimbursable,
    } as Parameters<typeof createTransaction>[0];

    try {
      // On edit, a blanked optional field must be sent as null so the server clears it;
      // undefined would mean "leave unchanged".
      if (existing) await updateTransaction(existing.id, {
        ...payload,
        categoryId: payload.categoryId ?? null,
        toAmount: payload.toAmount ?? null,
        note: payload.note ?? null,
      });
      else await createTransaction(payload);
      router.push('/transactions');
      router.refresh();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="max-w-lg space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="details">Details</Label>
        <Input id="details" name="details" defaultValue={existing?.details} required />
      </div>

      {(type === 'expense' || type === 'transfer') && (
        <div className="space-y-2">
          <Label htmlFor="fromAccountId">From account</Label>
          <Select name="fromAccountId" items={accountItems} defaultValue={existing?.fromAccountId ?? undefined}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {(type === 'expense' || type === 'income') && (
        <div className="space-y-2">
          <Label htmlFor="categoryId">Category</Label>
          {/* `key={type}` forces a remount when switching expense <-> income: both share this
              single conditional slot (unlike the brief's two separate per-type blocks), so
              without a key React would patch the existing Select in place and keep its old
              (now out-of-scope) selected category id instead of re-evaluating `defaultValue` —
              confirmed live in manual QA, where the trigger showed a stale category UUID after
              switching an expense transaction's type to income. */}
          <Select key={type} name="categoryId" items={categoryItems} defaultValue={categoryDefault}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>{relevantCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {(type === 'income' || type === 'transfer') && (
        <div className="space-y-2">
          <Label htmlFor="toAccountId">To account</Label>
          <Select name="toAccountId" items={accountItems} defaultValue={existing?.toAccountId ?? undefined}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" name="amount" defaultValue={existing?.amount} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" name="currency" defaultValue={existing?.currency ?? 'USD'} required maxLength={3} />
        </div>
      </div>

      {type === 'transfer' && (
        <div className="space-y-2">
          <Label htmlFor="toAmount">To amount (only if currencies differ)</Label>
          <Input id="toAmount" name="toAmount" defaultValue={existing?.toAmount ?? undefined} />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="payDate">Date</Label>
        <Input id="payDate" name="payDate" type="date" defaultValue={existing?.payDate} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Note</Label>
        <Input id="note" name="note" defaultValue={existing?.note ?? undefined} />
      </div>

      <Label className="flex items-center gap-2">
        <Switch checked={reimbursable} onCheckedChange={setReimbursable} />
        Reimbursable
      </Label>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save transaction'}</Button>
        {existing && (
          <ConfirmButton
            label="Delete"
            description="Delete this transaction? This cannot be undone."
            onConfirm={() => deleteTransaction(existing.id)}
            redirectTo="/transactions"
          />
        )}
      </div>
    </form>
  );
}
