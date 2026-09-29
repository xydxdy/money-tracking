'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBudget } from '@/app/actions/budgets';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Category } from '@/db/schema';

function describeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === 'FORBIDDEN') return 'That category is not valid.';
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

export function BudgetForm({ month, categories }: { month: string; categories: Category[] }) {
  const router = useRouter();
  const budgetableCategories = categories.filter((c) => !c.noBudget && c.type === 'expense');
  const [categoryId, setCategoryId] = useState(budgetableCategories[0]?.id ?? '');
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
      await createBudget({
        month,
        categoryId,
        currency: String(formData.get('currency')),
        plannedAmount: String(formData.get('plannedAmount')),
      });
      router.refresh();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? '')} items={categoryItems}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            {budgetableCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="plannedAmount">Planned amount</Label>
        <Input id="plannedAmount" name="plannedAmount" className="w-32" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="currency">Currency</Label>
        <Input id="currency" name="currency" defaultValue="USD" className="w-20" maxLength={3} required />
      </div>
      <Button type="submit" disabled={pending || !categoryId}>{pending ? 'Saving…' : 'Add budget'}</Button>
      {error && <p role="alert" className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
