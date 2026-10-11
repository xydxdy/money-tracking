import { accountColorClasses } from '@/lib/account-appearance';

/** Rounded tile with the account's emoji on its colour; falls back gracefully for old rows. */
export function AccountAvatar({ icon, color, size = 'md' }: { icon?: string | null; color?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'size-7 text-sm rounded-md', md: 'size-10 text-lg rounded-lg', lg: 'size-14 text-2xl rounded-xl' };
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center ${sizes[size]} ${accountColorClasses(color).tile}`}>
      {icon || '🏦'}
    </span>
  );
}
