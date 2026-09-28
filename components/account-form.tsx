'use client';
import { useState } from 'react';
import { createAccount } from '@/app/actions/accounts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';

const ACCOUNT_TYPES = ['bank', 'credit', 'cash', 'wallet', 'travel', 'grant'] as const;

export function AccountForm() {
  const router = useRouter();
  const [type, setType] = useState<(typeof ACCOUNT_TYPES)[number]>('bank');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      await createAccount({
        name: String(formData.get('name')),
        type,
        currency: String(formData.get('currency')),
        startingBalance: String(formData.get('startingBalance') || '0'),
      });
      router.refresh();
    } catch {
      setError('Could not create account. Check the fields and try again.');
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
        <Label>Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="currency">Currency</Label>
        <Input id="currency" name="currency" placeholder="USD" required maxLength={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="startingBalance">Starting balance</Label>
        <Input id="startingBalance" name="startingBalance" placeholder="0.00" />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create account'}</Button>
    </form>
  );
}
