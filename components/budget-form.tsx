'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBudget, updateBudget } from '@/app/actions/budgets';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Budget, Category } from '@/db/schema';
import { CurrencySelect } from '@/components/currency-select';

function describeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === 'FORBIDDEN') return 'That category is not valid.';
    if (err.message === 'BUDGET_EXISTS') return 'A budget for this category and currency already exists this month.';
    if ((err as { name?: string }).name === 'ZodError') {
      try {
        const issues = JSON.parse(err.message) as Array<{ message?: string }>;
        if (issues[0]?.message) return issues[0].message;
      } catch {
        // fall through to the generic message below
      }
    }
  }
  return 'Could not save budget. Check the planned amount and currency.';
}

export function BudgetForm({ month, categories, existing, onSaved, defaultCurrency = 'USD' }: {
  month: string; categories: Category[]; existing?: Budget; onSaved?: () => void; defaultCurrency?: string;
}) {
  const router = useRouter();
  const budgetableCategories = categories.filter(
    (c) => (c.type === 'expense' && !c.archived) || c.id === existing?.categoryId
  );
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? budgetableCategories[0]?.id ?? '');
  const idPrefix = existing ? `budget-${existing.id}` : 'budget-new';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // This Base UI Select's value is a category *id* while its label is the
  // icon+name — without `items` (a value->label map) the trigger renders the
  // raw id instead of a readable label. Same fix as components/transaction-form.tsx.
  const categoryItems = Object.fromEntries(
    budgetableCategories.map((c) => [c.id, c.icon ? `${c.icon} ${c.name}` : c.name])
  );

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      if (!categoryId) {
        setError('Add an expense category before creating a budget.');
        return;
      }
      const input = {
        month,
        categoryId,
        currency: String(formData.get('currency')).toUpperCase(),
        plannedAmount: String(formData.get('plannedAmount')),
      };
      if (existing) await updateBudget(existing.id, input);
      else await createBudget(input);
      router.refresh();
      onSaved?.();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className={existing || onSaved ? 'space-y-4' : 'space-y-4 rounded-xl border bg-card p-5 shadow-xs'}>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-category`}>Category</Label>
        {budgetableCategories.length > 0 ? (
          <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? '')} items={categoryItems}>
            <SelectTrigger id={`${idPrefix}-category`} className="w-full"><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {budgetableCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            You have no expense categories yet. <a href="/settings/categories" className="text-primary hover:underline">Add one</a> first.
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-plannedAmount`}>Planned amount</Label>
          <Input id={`${idPrefix}-plannedAmount`} name="plannedAmount" defaultValue={existing?.plannedAmount} inputMode="decimal" placeholder="0.00" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-currency`}>Currency</Label>
          <CurrencySelect id={`${idPrefix}-currency`} name="currency" defaultValue={existing?.currency ?? defaultCurrency} className="sm:w-48" />
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full sm:w-auto" disabled={pending || !categoryId}>
        {pending ? 'Saving…' : existing ? 'Save changes' : 'Add budget'}
      </Button>
    </form>
  );
}
