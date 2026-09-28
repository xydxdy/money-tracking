'use client';
import { useState } from 'react';
import { createCategory } from '@/app/actions/categories';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';

const TYPES = ['expense', 'income', 'transfer'] as const;

export function CategoryForm() {
  const router = useRouter();
  const [type, setType] = useState<(typeof TYPES)[number]>('expense');
  const [noBudget, setNoBudget] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      await createCategory({
        name: String(formData.get('name')),
        type,
        icon: String(formData.get('icon') || ''),
        noBudget,
      });
      setNoBudget(false);
      router.refresh();
    } catch {
      setError('Could not create category. Check the fields and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="icon">Icon (emoji)</Label>
        <Input id="icon" name="icon" placeholder="🛒" />
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
      <div className="flex items-center gap-2">
        <Switch checked={noBudget} onCheckedChange={setNoBudget} id="noBudget" />
        <Label htmlFor="noBudget">Exclude from budgeting</Label>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create category'}</Button>
    </form>
  );
}
