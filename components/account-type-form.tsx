'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAccountType, updateAccountType } from '@/app/actions/account-types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { IconPicker } from '@/components/icon-picker';
import { ColorPicker } from '@/components/color-picker';
import { AccountAvatar } from '@/components/account-avatar';
import { ACCOUNT_ICONS, FALLBACK_APPEARANCE, type AccountColor } from '@/lib/account-appearance';
import type { AccountType } from '@/db/schema';

const ICON_GROUPS = [{ label: 'Icons', icons: ACCOUNT_ICONS }];

export function AccountTypeForm({ existing, onSaved }: { existing?: AccountType; onSaved?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? FALLBACK_APPEARANCE.icon);
  const [color, setColor] = useState<AccountColor>((existing?.color as AccountColor) ?? 'blue');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idPrefix = existing ? `type-${existing.id}` : 'type-new';

  async function onSubmit() {
    setPending(true);
    setError(null);
    try {
      if (existing) await updateAccountType(existing.id, { name, icon, color });
      else await createAccountType({ name, icon, color });
      router.refresh();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error && err.message === 'TYPE_EXISTS'
        ? 'You already have an account type with that name.'
        : 'Could not save the account type. Check the fields and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
        <AccountAvatar icon={icon} color={color} size="lg" />
        <p className="font-medium">{name || 'New account type'}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input id={`${idPrefix}-name`} value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="e.g. Savings" />
      </div>
      <div className="space-y-2">
        <Label>Colour</Label>
        <ColorPicker name="color" defaultValue={color} onChange={setColor} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-icon`}>Icon</Label>
        <IconPicker id={`${idPrefix}-icon`} name="icon" defaultValue={icon} groups={ICON_GROUPS} onChange={setIcon} />
      </div>
      <p className="text-xs text-muted-foreground">New accounts of this type start with this colour and icon. Existing accounts keep their own.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? 'Saving…' : existing ? 'Save changes' : 'Create type'}</Button>
    </form>
  );
}
