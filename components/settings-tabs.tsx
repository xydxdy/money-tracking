'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/settings/categories', label: 'Categories' },
  { href: '/settings/account-types', label: 'Account types' },
  { href: '/settings/data', label: 'Data' },
  { href: '/settings/profile', label: 'Profile' },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b" aria-label="Settings sections">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${active ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
