'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboardIcon, ArrowLeftRightIcon, WalletIcon, PiggyBankIcon, ReceiptIcon,
  SettingsIcon, LogOutIcon, MenuIcon, XIcon, HandCoinsIcon,
} from 'lucide-react';
import { signOutAction } from '@/app/actions/auth-ui';
import { ThemeToggle } from '@/components/theme-toggle';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRightIcon },
  { href: '/accounts', label: 'Accounts', icon: WalletIcon },
  { href: '/budgets', label: 'Budgets', icon: PiggyBankIcon },
  { href: '/loans', label: 'Loans', icon: HandCoinsIcon },
  { href: '/reimbursements', label: 'Reimbursements', icon: ReceiptIcon },
];

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 px-2 font-semibold">
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <WalletIcon className="size-4" />
      </span>
      Money Tracking
    </Link>
  );
}

function NavLinks({ onNavigate, email, name }: { onNavigate?: () => void; email?: string | null; name?: string | null }) {
  const pathname = usePathname();
  const item = (active: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active
      ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
      : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'}`;
  return (
    <div className="flex h-full flex-col justify-between gap-4">
      <ul className="space-y-1">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} onClick={onNavigate} className={item(pathname.startsWith(href))} aria-current={pathname.startsWith(href) ? 'page' : undefined}>
              <Icon className="size-4" />{label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="space-y-1 border-t pt-4">
        <Link href="/settings" onClick={onNavigate} className={item(pathname.startsWith('/settings'))}>
          <SettingsIcon className="size-4" />Settings
        </Link>
        <ThemeToggle />
        <form action={signOutAction}>
          <button className={`${item(false)} w-full`}><LogOutIcon className="size-4" />Sign out</button>
        </form>
        {email && (
          <Link href="/settings/profile" onClick={onNavigate} className="block truncate rounded-lg px-3 pt-2 text-xs text-muted-foreground hover:text-foreground" title={email}>
            {name && <span className="block truncate text-sm font-medium text-foreground">{name}</span>}
            {email}
          </Link>
        )}
      </div>
    </div>
  );
}

export function Nav({ email, name }: { email?: string | null; name?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 md:flex">
        <Brand />
        <NavLinks email={email} name={name} />
      </aside>

      {/* Mobile top bar + slide-in menu */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-sidebar/95 px-4 py-3 backdrop-blur md:hidden">
        <Brand />
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 hover:bg-accent">
          <MenuIcon className="size-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col gap-6 bg-sidebar p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-2 hover:bg-accent">
                <XIcon className="size-5" />
              </button>
            </div>
            <NavLinks email={email} name={name} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
