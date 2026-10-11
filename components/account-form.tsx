'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAccount, updateAccount } from '@/app/actions/accounts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconPicker } from '@/components/icon-picker';
import { ColorPicker } from '@/components/color-picker';
import { CurrencySelect } from '@/components/currency-select';
import { IconLabel } from '@/components/app-icon';
import { AccountAvatar } from '@/components/account-avatar';
import { ACCOUNT_ICONS, FALLBACK_APPEARANCE, type AccountColor } from '@/lib/account-appearance';
import { currencySymbol } from '@/lib/currencies';
import type { Account, AccountType } from '@/db/schema';

const ICON_GROUPS = [{ label: 'Icons', icons: ACCOUNT_ICONS }];

function appearanceOf(type: AccountType | undefined) {
  return { icon: type?.icon ?? FALLBACK_APPEARANCE.icon, color: FALLBACK_APPEARANCE.color };
}

export function AccountForm({ existing, types, onSaved }: { existing?: Account; types: AccountType[]; onSaved?: () => void }) {
  const router = useRouter();
  const [typeId, setTypeId] = useState<string>(existing ? (existing.accountTypeId ?? '') : (types[0]?.id ?? ''));
  const typeOf = (id: string) => types.find((t) => t.id === id);
  const typeItems = { '': 'No type', ...Object.fromEntries(types.map((t) => [t.id, <IconLabel key={t.id} icon={t.icon} fallback="landmark">{t.name}</IconLabel>])) };
  const initial = existing
    ? { icon: existing.icon ?? FALLBACK_APPEARANCE.icon, color: (existing.color ?? FALLBACK_APPEARANCE.color) as AccountColor }
    : appearanceOf(typeOf(typeId));
  const [icon, setIcon] = useState(initial.icon);
  const [color, setColor] = useState<AccountColor>(initial.color);
  // Until the user picks their own colour/icon, a new account's look follows its type.
  const [customised, setCustomised] = useState(!!existing);
  const [pickerKey, setPickerKey] = useState(0);
  const [name, setName] = useState(existing?.name ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idPrefix = existing ? `account-${existing.id}` : 'account-new';

  function onTypeChange(next: string) {
    setTypeId(next);
    if (!customised) {
      const d = appearanceOf(typeOf(next));
      setIcon(d.icon);
      setColor(d.color);
      setPickerKey((k) => k + 1);
    }
  }

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const common = {
      name: String(formData.get('name')),
      accountTypeId: typeId || null,
      startingBalance: String(formData.get('startingBalance') || '0'),
      // Always sent, so blanking the note on edit clears it.
      note: String(formData.get('note') ?? ''),
      color,
      icon,
    };
    try {
      if (existing) await updateAccount(existing.id, common);
      else await createAccount({ ...common, currency: String(formData.get('currency')).toUpperCase() });
      router.refresh();
      onSaved?.();
    } catch {
      setError(existing ? 'Could not save account. Check the fields and try again.' : 'Could not create account. Check the fields and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className={onSaved || existing ? 'space-y-4' : 'space-y-4 rounded-lg border p-4'}>
      <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
        <AccountAvatar icon={icon} color={color} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-medium">{name || 'New account'}</p>
          <p className="text-sm text-muted-foreground">{typeOf(typeId)?.name ?? 'No type'}{existing ? ` · ${existing.currency}` : ''}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input id={`${idPrefix}-name`} name="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Type</Label>
            <a href="/settings/account-types" className="text-xs text-primary hover:underline">Manage types</a>
          </div>
          <Select value={typeId} onValueChange={(v) => onTypeChange(v ?? '')} items={typeItems}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {types.map((t) => <SelectItem key={t.id} value={t.id}><IconLabel icon={t.icon} fallback="landmark">{t.name}</IconLabel></SelectItem>)}
              <SelectItem value="">No type</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-currency`}>Currency</Label>
          {existing ? (
            <Input id={`${idPrefix}-currency`} value={`${currencySymbol(existing.currency)} ${existing.currency}`} disabled title="An account's currency can't be changed" />
          ) : (
            <CurrencySelect id={`${idPrefix}-currency`} name="currency" defaultValue="USD" />
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Colour</Label>
        <ColorPicker key={`c-${pickerKey}`} name="color" defaultValue={color} onChange={(c) => { setColor(c); setCustomised(true); }} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-icon`}>Icon</Label>
        <IconPicker key={`i-${pickerKey}`} id={`${idPrefix}-icon`} name="icon" defaultValue={icon} groups={ICON_GROUPS}
          onChange={(i) => { setIcon(i); setCustomised(true); }} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-startingBalance`}>Starting balance</Label>
          <Input id={`${idPrefix}-startingBalance`} name="startingBalance" placeholder="0.00" inputMode="decimal" defaultValue={existing?.startingBalance} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-note`}>Note</Label>
          <Input id={`${idPrefix}-note`} name="note" defaultValue={existing?.note ?? undefined} />
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? (existing ? 'Saving…' : 'Creating…') : (existing ? 'Save changes' : 'Create account')}
      </Button>
    </form>
  );
}
