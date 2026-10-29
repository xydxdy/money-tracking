'use client';
import { useMemo, useState } from 'react';
import { CheckIcon, ChevronDownIcon, SearchIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AccountAvatar } from '@/components/account-avatar';
import { AppIcon } from '@/components/app-icon';
import { FavoriteStar } from '@/components/favorite-toggle';
import { formatMoney } from '@/lib/money';
import { matchesQuery } from '@/lib/account-groups';
import type { Account, AccountGroup } from '@/db/schema';

type Props = {
  id: string;
  /** The form field the chosen account id is submitted under. */
  name: string;
  label: string;
  /** Already filtered (no archived accounts unless in use) and sorted by group, favourites first. */
  accounts: Account[];
  groups: AccountGroup[];
  /** Current balance per account id, in cents; shown when known. */
  balances?: Record<string, number>;
  value: string;
  onChange: (id: string) => void;
  /** An account that can't be picked here, e.g. the other side of a transfer. */
  disabledId?: string;
};

/**
 * Account field: a large button showing the chosen account, one-tap chips for favourites, and a
 * searchable dialog listing every account under its group.
 */
export function AccountPicker({ id, name, label, accounts, groups, balances, value, onChange, disabledId }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const selected = accounts.find((a) => a.id === value);
  const groupName = (a: Account) => (a.groupId ? groupById.get(a.groupId)?.name : undefined);
  const balanceLabel = (a: Account) => (balances?.[a.id] !== undefined ? formatMoney(balances[a.id], a.currency) : undefined);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
    setQuery('');
  }

  // Sections in the dialog: favourites (when not searching), then each group, then the rest.
  const shown = accounts.filter((a) => matchesQuery(query, a.name, a.currency, groupName(a)));
  const sections: { key: string; title: string; icon?: string | null; accounts: Account[] }[] = [];
  const favourites = accounts.filter((a) => a.favorite);
  if (query.trim() === '' && favourites.length > 0) sections.push({ key: 'fav', title: 'Favourites', accounts: favourites });
  for (const a of shown) {
    const key = a.groupId && groupById.has(a.groupId) ? a.groupId : 'none';
    let section = sections.find((s) => s.key === key);
    if (!section) {
      const g = groupById.get(key);
      section = { key, title: g?.name ?? (groups.length > 0 ? 'Other accounts' : 'Accounts'), icon: g?.icon, accounts: [] };
      sections.push(section);
    }
    section.accounts.push(a);
  }

  const quickPicks = favourites.filter((a) => a.id !== disabledId).slice(0, 6);

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={value} />
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={selected ? `${label}: ${selected.name}` : `${label}: choose an account`}
        className="flex w-full items-center gap-3 rounded-xl border bg-background px-3 py-2.5 text-left transition-colors hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {selected ? (
          <>
            <AccountAvatar icon={selected.icon} color={selected.color} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="truncate">{selected.name}</span>
                {selected.favorite && <FavoriteStar favorite className="size-3.5 shrink-0" />}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {[groupName(selected), selected.currency, balanceLabel(selected)].filter(Boolean).join(' · ')}
              </span>
            </span>
          </>
        ) : (
          <>
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
              <AppIcon icon="landmark" />
            </span>
            <span className="flex-1 text-muted-foreground">Choose an account</span>
          </>
        )}
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {quickPicks.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label={`Favourite accounts for ${label}`}>
          {quickPicks.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onChange(a.id)}
              aria-pressed={a.id === value}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${a.id === value
                ? 'border-primary bg-primary/10 font-medium text-primary'
                : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground'}`}
            >
              <FavoriteStar favorite className="size-3 shrink-0" />
              <span className="truncate">{a.name}</span>
              <span className="opacity-70">{a.currency}</span>
            </button>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(''); }}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-md">
          <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search accounts, banks, currencies…"
              aria-label="Search accounts"
              className="pl-8"
            />
          </div>
          <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4">
            {sections.map((s) => (
              <div key={s.key} className="pb-3">
                <p className="sticky top-0 z-10 flex items-center gap-1.5 bg-popover py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {s.key === 'fav' ? <FavoriteStar favorite className="size-3" /> : s.icon ? <AppIcon icon={s.icon} className="size-3" /> : null}
                  {s.title}
                </p>
                <ul className="space-y-0.5">
                  {s.accounts.map((a) => {
                    const disabled = a.id === disabledId;
                    const isSelected = a.id === value;
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => pick(a.id)}
                          className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${isSelected ? 'bg-primary/10' : 'hover:bg-accent'}`}
                        >
                          <AccountAvatar icon={a.icon} color={a.color} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate font-medium">{a.name}</span>
                              {a.favorite && s.key !== 'fav' && <FavoriteStar favorite className="size-3 shrink-0" />}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {s.key === 'fav' && groupName(a) ? `${groupName(a)} · ` : ''}{a.currency}
                              {disabled ? ' · already used on the other side' : ''}
                            </span>
                          </span>
                          {balanceLabel(a) && (
                            <span className={`shrink-0 text-sm tabular-nums ${(balances?.[a.id] ?? 0) < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {balanceLabel(a)}
                            </span>
                          )}
                          {isSelected && <CheckIcon className="size-4 shrink-0 text-primary" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {shown.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No accounts match “{query.trim()}”.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
