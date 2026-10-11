'use client';
import { useState } from 'react';
import { createCategory, updateCategory } from '@/app/actions/categories';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import type { Category } from '@/db/schema';
import { IconPicker } from '@/components/icon-picker';
import { randomCategoryIcon } from '@/lib/category-icons';

const TYPES = ['expense', 'income', 'transfer'] as const;

function describeError(err: unknown, editing: boolean): string {
  if (err instanceof Error && err.message === 'CATEGORY_IN_USE') {
    return 'This category is used by transactions, so its type cannot change.';
  }
  return editing ? 'Could not save category. Check the fields and try again.' : 'Could not create category. Check the fields and try again.';
}

export function CategoryForm({ existing, onSaved }: { existing?: Category; onSaved?: () => void }) {
  const router = useRouter();
  const [type, setType] = useState<(typeof TYPES)[number]>(existing?.type ?? 'expense');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idPrefix = existing ? `category-${existing.id}` : 'category-new';
  // A new category starts with a random icon; editing keeps the current one. This form only
  // renders inside a dialog (client-side), so the random pick can't cause a hydration mismatch.
  const [initialIcon] = useState(() => existing?.icon ?? randomCategoryIcon());
  // Remounting the picker after a create gives the next new category a fresh random icon.
  const [pickerKey, setPickerKey] = useState(0);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const input = {
      name: String(formData.get('name')),
      type,
      icon: String(formData.get('icon') || ''),
    };
    try {
      if (existing) {
        await updateCategory(existing.id, input);
      } else {
        await createCategory(input);
        setPickerKey((k) => k + 1);
      }
      router.refresh();
      onSaved?.();
    } catch (err) {
      setError(describeError(err, !!existing));
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className={existing || onSaved ? 'space-y-4' : 'space-y-4 rounded-lg border p-4'}>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input id={`${idPrefix}-name`} name="name" defaultValue={existing?.name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-icon`}>Icon</Label>
        <IconPicker key={pickerKey} id={`${idPrefix}-icon`} name="icon" defaultValue={pickerKey === 0 ? initialIcon : randomCategoryIcon()} />
      </div>
      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? (existing ? 'Saving…' : 'Creating…') : (existing ? 'Save changes' : 'Create category')}
      </Button>
    </form>
  );
}
