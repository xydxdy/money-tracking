'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAccountGroup, updateAccountGroup } from '@/app/actions/account-groups';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { IconPicker } from '@/components/icon-picker';
import { ColorPicker } from '@/components/color-picker';
import { AccountAvatar } from '@/components/account-avatar';
import { ACCOUNT_ICONS, type AccountColor } from '@/lib/account-appearance';
import type { AccountGroup } from '@/db/schema';

const ICON_GROUPS = [{ label: 'Icons', icons: ACCOUNT_ICONS }];

export function AccountGroupForm({ existing, onSaved }: { existing?: AccountGroup; onSaved?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? 'landmark');
  const [color, setColor] = useState<AccountColor>((existing?.color ?? 'slate') as AccountColor);
  const [note, setNote] = useState(existing?.note ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idPrefix = existing ? `group-${existing.id}` : 'group-new';

  async function onSubmit() {
    setPending(true);
    setError(null);
    try {
      const data = { name, icon, color, note };
      if (existing) await updateAccountGroup(existing.id, data);
      else await createAccountGroup(data);
      router.refresh();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error && err.message === 'GROUP_EXISTS'
        ? 'You already have a group with that name.'
        : 'Could not save the group. Check the fields and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
        <AccountAvatar icon={icon} color={color} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-medium">{name || 'New group'}</p>
          <p className="text-sm text-muted-foreground">Holds accounts in any currency</p>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input id={`${idPrefix}-name`} value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="e.g. Kasikorn Bank" />
      </div>
      <div className="space-y-2">
        <Label>Colour</Label>
        <ColorPicker name="color" defaultValue={color} onChange={setColor} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-icon`}>Icon</Label>
        <IconPicker id={`${idPrefix}-icon`} name="icon" defaultValue={icon} groups={ICON_GROUPS} onChange={setIcon} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-note`}>Note</Label>
        <Input id={`${idPrefix}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? 'Saving…' : existing ? 'Save changes' : 'Create group'}</Button>
    </form>
  );
}
