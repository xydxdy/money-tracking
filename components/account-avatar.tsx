import { accountColorClasses } from '@/lib/account-appearance';
import { AppIcon } from '@/components/app-icon';

/** Rounded tile with the account's icon on its colour; falls back gracefully for old rows. */
export function AccountAvatar({ icon, color, size = 'md' }: { icon?: string | null; color?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'size-7 rounded-md [&_svg]:size-3.5', md: 'size-10 rounded-lg [&_svg]:size-5', lg: 'size-14 rounded-xl [&_svg]:size-7' };
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center ${sizes[size]} ${accountColorClasses(color).tile}`}>
      <AppIcon icon={icon} fallback="landmark" />
    </span>
  );
}
