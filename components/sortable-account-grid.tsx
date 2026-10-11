'use client';
import { useState } from 'react';
import Link from 'next/link';
import { GripVerticalIcon } from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { reorderAccounts } from '@/app/actions/accounts';
import { Badge } from '@/components/ui/badge';
import { AppIcon } from '@/components/app-icon';
import { AccountAvatar } from '@/components/account-avatar';
import { accountColorClasses } from '@/lib/account-appearance';

export type AccountCard = {
  id: string; name: string; type: string; typeIcon: string | null; currency: string; archived: boolean; balanceLabel: string;
  color: string | null; icon: string | null; negative: boolean;
  /** Net change this month, formatted with a sign (e.g. "+$320.00"). */
  monthChangeLabel: string;
  monthChangeCents: number;
};

/** The inside of an account card; `handle` is the drag handle when the card is sortable. */
export function AccountCardView({ account, handle }: { account: AccountCard; handle?: React.ReactNode }) {
  const change = account.monthChangeCents;
  return (
    <>
      {handle}
      <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${accountColorClasses(account.color).bar}`} />
      <Link href={`/accounts/${account.id}`} className="block p-4 pr-10">
        <div className="flex items-center gap-3">
          <AccountAvatar icon={account.icon} color={account.color} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{account.name}</span>
              {account.archived && <Badge variant="secondary">Archived</Badge>}
            </div>
            <p className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
              <AppIcon icon={account.typeIcon} fallback="landmark" className="size-3.5 shrink-0" />
              <span className="truncate">{account.type} · {account.currency}</span>
            </p>
          </div>
        </div>
        <p className={`mt-4 text-2xl font-semibold tracking-tight tabular-nums ${account.negative ? 'text-destructive' : ''}`}>{account.balanceLabel}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This month:{' '}
          <span className={`font-medium tabular-nums ${change > 0 ? 'text-positive' : change < 0 ? 'text-destructive' : ''}`}>
            {change === 0 ? 'no change' : account.monthChangeLabel}
          </span>
        </p>
      </Link>
    </>
  );
}

/** A plain (non-draggable) account card, e.g. for archived accounts. */
export function AccountCardStatic({ account }: { account: AccountCard }) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card opacity-70 shadow-xs transition hover:opacity-100 hover:shadow-md">
      <AccountCardView account={account} />
    </div>
  );
}

function SortableCard({ account }: { account: AccountCard }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: account.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-md ${account.archived ? 'opacity-60' : ''} ${isDragging ? 'z-10 shadow-lg' : ''}`}
    >
      <AccountCardView
        account={account}
        handle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={`Drag to reorder ${account.name}`}
            className="absolute top-3 right-2 z-10 cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-accent active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon className="size-4" />
          </button>
        }
      />
    </div>
  );
}

export function SortableAccountGrid({ accounts }: { accounts: AccountCard[] }) {
  const [items, setItems] = useState(accounts);
  const [error, setError] = useState<string | null>(null);
  const [prevAccounts, setPrevAccounts] = useState(accounts);
  // Re-sync when the server sends a new list (e.g. after an account is created).
  if (accounts !== prevAccounts) {
    setPrevAccounts(accounts);
    setItems(accounts);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const previous = items;
    const next = arrayMove(items, items.findIndex((a) => a.id === active.id), items.findIndex((a) => a.id === over.id));
    setItems(next);
    setError(null);
    try {
      await reorderAccounts(next.map((a) => a.id));
    } catch {
      setItems(previous);
      setError('Could not save the new order. Please try again.');
    }
  }

  return (
    <div className="space-y-2">
      <DndContext id="account-order" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((a) => a.id)} strategy={rectSortingStrategy}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((a) => <SortableCard key={a.id} account={a} />)}
          </div>
        </SortableContext>
      </DndContext>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
