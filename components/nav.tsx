'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/app/actions/auth-ui';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/budgets', label: 'Budgets' },
  { href: '/categories', label: 'Categories' },
  { href: '/reimbursements', label: 'Reimbursements' },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex h-full flex-col justify-between border-r p-4">
      <ul className="space-y-1">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={`block rounded-md px-3 py-2 text-sm ${pathname.startsWith(link.href) ? 'bg-accent font-medium' : 'hover:bg-accent/50'}`}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <ul className="space-y-1 border-t pt-4">
        <li><Link href="/settings" className="block rounded-md px-3 py-2 text-sm hover:bg-accent/50">Settings</Link></li>
        <li><form action={signOutAction}><button className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent/50">Sign Out</button></form></li>
      </ul>
    </nav>
  );
}
