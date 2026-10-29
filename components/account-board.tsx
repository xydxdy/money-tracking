'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRightIcon, ChevronsDownUpIcon, ChevronsUpDownIcon, EllipsisIcon, FolderInputIcon, FolderMinusIcon,
  GripVerticalIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon, XIcon,
} from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { reorderAccounts } from '@/app/actions/accounts';
import { deleteAccountGroup, moveAccountToGroup, reorderAccountGroups } from '@/app/actions/account-groups';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/confirm-button';
import { AppIcon } from '@/components/app-icon';
import { AccountAvatar } from '@/components/account-avatar';
import { AccountForm } from '@/components/account-form';
import { AccountGroupForm } from '@/components/account-group-form';
import { FavoriteToggle } from '@/components/favorite-toggle';
import { accountColorClasses } from '@/lib/account-appearance';
import { formatMoney } from '@/lib/money';
import { matchesQuery, totalsByCurrency } from '@/lib/account-groups';
import type { AccountGroup, AccountType } from '@/db/schema';

export type AccountRow = {
  id: string; name: string; type: string; typeIcon: string | null; currency: string; archived: boolean; favorite: boolean;
  color: string | null; icon: string | null; groupId: string | null;
  balanceCents: number;
  /** Net change this month. */
  monthChangeCents: number;
};

/** Accounts not in any group are kept under this key. */
const UNGROUPED = '';
const COLLAPSED_KEY = 'accounts:collapsed-groups';

function signed(cents: number, currency: string) {
  return `${cents > 0 ? '+' : ''}${formatMoney(cents, currency)}`;
}

function bucket(accounts: AccountRow[]) {
  const byGroup: Record<string, AccountRow[]> = {};
  for (const a of accounts) (byGroup[a.groupId ?? UNGROUPED] ??= []).push(a);
  return byGroup;
}

function useDragSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

function DragHandle({ label, ...props }: { label: string } & React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-label={label}
      className="shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground/60 hover:bg-accent hover:text-foreground active:cursor-grabbing"
      {...props}
    >
      <GripVerticalIcon className="size-4" />
    </button>
  );
}

/** Per-currency totals as small pills; a group may hold several currencies. */
function CurrencyTotals({ rows, className = '' }: { rows: AccountRow[]; className?: string }) {
  const totals = totalsByCurrency(rows);
  if (totals.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {totals.map((t) => (
        <span key={t.currency} className="inline-flex items-baseline gap-1.5 rounded-md bg-muted px-2 py-0.5 text-sm">
          <span className="text-xs text-muted-foreground">{t.currency}</span>
          <span className={`font-semibold tabular-nums ${t.cents < 0 ? 'text-destructive' : ''}`}>{formatMoney(t.cents, t.currency)}</span>
        </span>
      ))}
    </div>
  );
}

function MoveMenu({ account, groups }: { account: AccountRow; groups: AccountGroup[] }) {
  const router = useRouter();
  const [error, setError] = useState(false);
  async function move(groupId: string | null) {
    setError(false);
    try {
      await moveAccountToGroup(account.id, groupId);
      router.refresh();
    } catch {
      setError(true);
    }
  }
  const targets = groups.filter((g) => g.id !== account.groupId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${account.name}`}
        className={`rounded-md p-1.5 transition-colors hover:bg-accent hover:text-foreground data-popup-open:bg-accent ${error ? 'text-destructive' : 'text-muted-foreground'}`}
        title={error ? 'Could not move the account. Please try again.' : undefined}
      >
        <EllipsisIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem render={<Link href={`/accounts/${account.id}`} />}><PencilIcon /> Open account</DropdownMenuItem>
        {!account.archived && (
          <DropdownMenuItem render={<Link href={`/transactions/new?account=${account.id}`} />}><PlusIcon /> Add transaction</DropdownMenuItem>
        )}
        {(targets.length > 0 || account.groupId) && <DropdownMenuSeparator />}
        {targets.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger><FolderInputIcon /> Move to group</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 w-52 overflow-y-auto">
              {targets.map((g) => (
                <DropdownMenuItem key={g.id} onClick={() => move(g.id)}>
                  <AppIcon icon={g.icon} fallback="landmark" /> <span className="truncate">{g.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {account.groupId && (
          <DropdownMenuItem onClick={() => move(null)}><FolderMinusIcon /> Remove from group</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountRowView({ account, groups, handle, showGroup }: {
  account: AccountRow; groups: AccountGroup[]; handle?: React.ReactNode; showGroup?: string;
}) {
  const change = account.monthChangeCents;
  return (
    <div className="flex items-center gap-1 py-1 pr-1.5 pl-1 sm:gap-2">
      {handle ?? <span className="w-6 shrink-0" />}
      <Link href={`/accounts/${account.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1.5 py-1.5 hover:bg-muted/60">
        <AccountAvatar icon={account.icon} color={account.color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{account.name}</span>
            {account.archived && <Badge variant="secondary">Archived</Badge>}
          </div>
          <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <AppIcon icon={account.typeIcon} fallback="landmark" className="size-3 shrink-0" />
            <span className="truncate">{showGroup ? `${showGroup} · ` : ''}{account.type}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-semibold tabular-nums ${account.balanceCents < 0 ? 'text-destructive' : ''}`}>
            {formatMoney(account.balanceCents, account.currency)}
          </p>
          <p className={`text-xs tabular-nums ${change > 0 ? 'text-positive' : change < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {change === 0 ? `${account.currency} · no change` : `${signed(change, account.currency)} this month`}
          </p>
        </div>
      </Link>
      {!account.archived && <FavoriteToggle accountId={account.id} accountName={account.name} favorite={account.favorite} />}
      <MoveMenu account={account} groups={groups} />
    </div>
  );
}

function SortableAccountRow({ account, groups, draggable }: { account: AccountRow; groups: AccountGroup[]; draggable: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: account.id, disabled: !draggable });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative bg-card ${isDragging ? 'z-10 rounded-lg shadow-lg ring-1 ring-border' : ''}`}
    >
      <AccountRowView
        account={account}
        groups={groups}
        handle={draggable
          ? <DragHandle ref={setActivatorNodeRef} label={`Drag to reorder ${account.name}`} {...attributes} {...listeners} />
          : undefined}
      />
    </li>
  );
}

/** A sortable list of accounts; each group gets its own, so accounts are reordered within their group. */
function AccountList({ id, accounts, groups, draggable, onReorder }: {
  id: string; accounts: AccountRow[]; groups: AccountGroup[]; draggable: boolean; onReorder: (next: AccountRow[]) => void;
}) {
  const sensors = useDragSensors();
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(accounts, accounts.findIndex((a) => a.id === active.id), accounts.findIndex((a) => a.id === over.id)));
  }
  return (
    <DndContext id={`accounts-${id || 'ungrouped'}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={accounts.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        <ul className="divide-y">
          {accounts.map((a) => <SortableAccountRow key={a.id} account={a} groups={groups} draggable={draggable} />)}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function GroupMenu({ group, count, types, groups }: { group: AccountGroup; count: number; types: AccountType[]; groups: AccountGroup[] }) {
  const [dialog, setDialog] = useState<'add' | 'edit' | 'delete' | null>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for the ${group.name} group`}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-popup-open:bg-accent"
        >
          <EllipsisIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setDialog('add')}><PlusIcon /> Add account</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog('edit')}><PencilIcon /> Edit group</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDialog('delete')}><Trash2Icon /> Delete group</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === 'add' || dialog === 'edit'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{dialog === 'add' ? `New account in ${group.name}` : `Edit ${group.name}`}</DialogTitle></DialogHeader>
          {dialog === 'add' && <AccountForm types={types} groups={groups} defaultGroupId={group.id} onSaved={() => setDialog(null)} />}
          {dialog === 'edit' && <AccountGroupForm existing={group} onSaved={() => setDialog(null)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => setDialog(open ? 'delete' : null)}
        description={count === 0
          ? `Delete the "${group.name}" group?`
          : `Delete the "${group.name}" group? Its ${count} ${count === 1 ? 'account is' : 'accounts are'} kept and become ungrouped.`}
        confirmLabel="Delete"
        onConfirm={() => deleteAccountGroup(group.id)}
      />
    </>
  );
}

function GroupSection({ group, accounts, groups, types, collapsed, onToggle, draggable, onReorder }: {
  group: AccountGroup; accounts: AccountRow[]; groups: AccountGroup[]; types: AccountType[];
  collapsed: boolean; onToggle: () => void; draggable: boolean; onReorder: (next: AccountRow[]) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: group.id, disabled: !draggable });
  const currencies = [...new Set(accounts.map((a) => a.currency))];
  const bodyId = `group-body-${group.id}`;
  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative overflow-hidden rounded-xl border bg-card shadow-xs ${isDragging ? 'z-20 shadow-lg' : ''}`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${accountColorClasses(group.color).bar}`} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 pr-2 pl-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
          {draggable
            ? <DragHandle ref={setActivatorNodeRef} label={`Drag to reorder the ${group.name} group`} {...attributes} {...listeners} />
            : <span className="w-6 shrink-0" />}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1.5 py-1 text-left hover:bg-muted/60"
          >
            <AccountAvatar icon={group.icon} color={group.color} />
            <div className="min-w-0">
              <h3 className="flex items-center gap-1.5 font-semibold">
                <span className="truncate">{group.name}</span>
                <ChevronRightIcon className={`size-4 shrink-0 text-muted-foreground transition-transform ${collapsed ? '' : 'rotate-90'}`} />
              </h3>
              <p className="truncate text-xs text-muted-foreground">
                {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
                {currencies.length > 0 && ` · ${currencies.join(', ')}`}
                {group.note && ` · ${group.note}`}
              </p>
            </div>
          </button>
        </div>
        <div className="flex w-full items-center justify-end gap-1 pl-9 sm:w-auto sm:pl-0">
          <CurrencyTotals rows={accounts} className="flex-1 justify-start sm:justify-end" />
          <GroupMenu group={group} count={accounts.length} types={types} groups={groups} />
        </div>
      </div>
      {!collapsed && (
        <div id={bodyId} className="border-t">
          {accounts.length > 0
            ? <AccountList id={group.id} accounts={accounts} groups={groups} draggable={draggable} onReorder={onReorder} />
            : <p className="px-4 py-3 text-sm text-muted-foreground">No accounts in this group yet. Use ⋯ → Add account, or move one here.</p>}
        </div>
      )}
    </section>
  );
}

export function AccountBoard({ accounts, groups, types }: { accounts: AccountRow[]; groups: AccountGroup[]; types: AccountType[] }) {
  const [byGroup, setByGroup] = useState(() => bucket(accounts));
  const [groupOrder, setGroupOrder] = useState(groups);
  const [prev, setPrev] = useState({ accounts, groups });
  // Re-sync when the server sends new data (e.g. after an account is created or moved).
  if (accounts !== prev.accounts || groups !== prev.groups) {
    setPrev({ accounts, groups });
    setByGroup(bucket(accounts));
    setGroupOrder(groups);
  }
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const sensors = useDragSensors();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only state, read after hydration
      if (Array.isArray(saved)) setCollapsed(new Set(saved.filter((x) => typeof x === 'string')));
    } catch { /* storage unavailable: everything starts expanded */ }
  }, []);
  function saveCollapsed(next: Set<string>) {
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
  }
  const toggle = (id: string) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id); else next.add(id);
    saveCollapsed(next);
  };

  const searching = query.trim() !== '';
  const groupName = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);
  const visible = (key: string) => {
    const rows = byGroup[key] ?? [];
    if (!searching) return rows;
    // A group whose name matches shows all its accounts.
    if (key !== UNGROUPED && matchesQuery(query, groupName.get(key))) return rows;
    return rows.filter((a) => matchesQuery(query, a.name, a.type, a.currency));
  };

  async function saveAccountOrder(key: string, next: AccountRow[]) {
    const previous = byGroup;
    const updated = { ...byGroup, [key]: next };
    setByGroup(updated);
    setError(null);
    try {
      // Positions are global; save groups in display order, then ungrouped accounts.
      const ids = [...groupOrder.map((g) => g.id), UNGROUPED].flatMap((k) => (updated[k] ?? []).map((a) => a.id));
      await reorderAccounts(ids);
    } catch {
      setByGroup(previous);
      setError('Could not save the new order. Please try again.');
    }
  }

  async function onGroupDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const previous = groupOrder;
    const next = arrayMove(groupOrder, groupOrder.findIndex((g) => g.id === active.id), groupOrder.findIndex((g) => g.id === over.id));
    setGroupOrder(next);
    setError(null);
    try {
      await reorderAccountGroups(next.map((g) => g.id));
    } catch {
      setGroupOrder(previous);
      setError('Could not save the new order. Please try again.');
    }
  }

  const shownGroups = groupOrder.filter((g) => !searching || visible(g.id).length > 0);
  const ungrouped = visible(UNGROUPED);
  const allCollapsed = groupOrder.length > 0 && groupOrder.every((g) => collapsed.has(g.id));
  const nothingFound = searching && shownGroups.length === 0 && ungrouped.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search accounts, groups, currencies…"
            aria-label="Search accounts"
            className="pl-8"
          />
          {searching && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery('')}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent">
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
        {groupOrder.length > 0 && !searching && (
          <Button type="button" variant="ghost" size="sm" onClick={() => saveCollapsed(allCollapsed ? new Set() : new Set(groupOrder.map((g) => g.id)))}>
            {allCollapsed ? <><ChevronsUpDownIcon /> Expand all</> : <><ChevronsDownUpIcon /> Collapse all</>}
          </Button>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {shownGroups.length > 0 && (
        <DndContext id="account-groups" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onGroupDragEnd}>
          <SortableContext items={shownGroups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {shownGroups.map((g) => (
                <GroupSection
                  key={g.id}
                  group={g}
                  accounts={visible(g.id)}
                  groups={groupOrder}
                  types={types}
                  collapsed={!searching && collapsed.has(g.id)}
                  onToggle={() => toggle(g.id)}
                  draggable={!searching}
                  onReorder={(next) => saveAccountOrder(g.id, next)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {ungrouped.length > 0 && (
        <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <div>
              <h3 className="font-semibold">{groupOrder.length > 0 ? 'Ungrouped' : 'All accounts'}</h3>
              <p className="text-xs text-muted-foreground">
                {ungrouped.length} {ungrouped.length === 1 ? 'account' : 'accounts'}
                {groupOrder.length > 0 && ' · use ⋯ → Move to group to organise'}
              </p>
            </div>
            <CurrencyTotals rows={ungrouped} />
          </div>
          <AccountList id={UNGROUPED} accounts={ungrouped} groups={groupOrder} draggable={!searching}
            onReorder={(next) => saveAccountOrder(UNGROUPED, next)} />
        </section>
      )}

      {nothingFound && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No accounts match “{query.trim()}”.</p>
      )}
    </div>
  );
}

/** Archived accounts: a plain list, collapsed by default. */
export function ArchivedAccounts({ accounts, groups }: { accounts: AccountRow[]; groups: AccountGroup[] }) {
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  return (
    <details className="group/archived">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium tracking-wide text-muted-foreground uppercase [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="size-4 transition-transform group-open/archived:rotate-90" /> Archived ({accounts.length})
      </summary>
      <ul className="mt-2 divide-y overflow-hidden rounded-xl border bg-card opacity-80 shadow-xs">
        {accounts.map((a) => (
          <li key={a.id}><AccountRowView account={a} groups={groups} showGroup={a.groupId ? groupName.get(a.groupId) : undefined} /></li>
        ))}
      </ul>
    </details>
  );
}
