import { Tag, type LucideProps } from 'lucide-react';
import { ICONS, toIconName } from '@/lib/icons';

/**
 * Draws a stored icon value (an icon name, or an emoji from older data) as a registry icon,
 * falling back to `fallback` for anything unknown.
 */
export function AppIcon({ icon, fallback = 'tag', ...props }: { icon?: string | null; fallback?: string } & Omit<LucideProps, 'name'>) {
  const Icon = ICONS[toIconName(icon) ?? fallback] ?? Tag;
  return <Icon aria-hidden {...props} />;
}

/** A category's icon on a soft tile. */
export function CategoryIcon({ name, size = 'md' }: { name?: string | null; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'size-6 rounded-md [&_svg]:size-3.5' : 'size-9 rounded-lg [&_svg]:size-4';
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center bg-muted text-muted-foreground ${box}`}>
      <AppIcon icon={name} />
    </span>
  );
}

/** Icon followed by text, for dropdown items and inline labels. */
export function IconLabel({ icon, children, fallback }: { icon?: string | null; children: React.ReactNode; fallback?: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <AppIcon icon={icon} fallback={fallback} className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{children}</span>
    </span>
  );
}
