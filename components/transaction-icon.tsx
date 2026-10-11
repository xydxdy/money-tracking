import { ArrowLeftRightIcon, HandCoinsIcon, TagIcon } from 'lucide-react';
import { AppIcon } from '@/components/app-icon';

/**
 * The icon shown for a transaction: its category's icon. Without a category, loans and
 * paid-by-a-person entries show a hand with coins, transfers show arrows, anything else a tag.
 */
export function TransactionIcon({ categoryIcon, type, viaPerson = false, size = 'md' }: {
  categoryIcon?: string | null; type: string; viaPerson?: boolean; size?: 'md' | 'lg';
}) {
  const box = size === 'lg' ? 'size-14 rounded-xl [&_svg]:size-7' : 'size-10 rounded-lg [&_svg]:size-5';
  const tile = (tone: string, icon: React.ReactNode) => (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center ${box} ${tone}`}>{icon}</span>
  );
  if (categoryIcon) return tile('bg-primary/10 text-primary', <AppIcon icon={categoryIcon} />);
  if (type === 'loan' || viaPerson) return tile('bg-amber-500/15 text-amber-700 dark:text-amber-300', <HandCoinsIcon />);
  if (type === 'transfer') return tile('bg-muted text-muted-foreground', <ArrowLeftRightIcon />);
  return tile('bg-muted text-muted-foreground', <TagIcon />);
}
