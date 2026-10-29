'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StarIcon } from 'lucide-react';
import { setAccountFavorite } from '@/app/actions/accounts';

/** Filled star for a favourite account; toggles it optimistically. */
export function FavoriteStar({ favorite, className = 'size-4' }: { favorite: boolean; className?: string }) {
  return <StarIcon aria-hidden className={`${className} ${favorite ? 'fill-amber-400 text-amber-400' : ''}`} />;
}

export function FavoriteToggle({ accountId, accountName, favorite, size = 'sm' }: {
  accountId: string; accountName: string; favorite: boolean; size?: 'sm' | 'md';
}) {
  const router = useRouter();
  const [value, setValue] = useState(favorite);
  const [prev, setPrev] = useState(favorite);
  const [pending, setPending] = useState(false);
  // Follow the server's value after a refresh.
  if (favorite !== prev) {
    setPrev(favorite);
    setValue(favorite);
  }

  async function toggle() {
    const next = !value;
    setValue(next);
    setPending(true);
    try {
      await setAccountFavorite(accountId, next);
      router.refresh();
    } catch {
      setValue(!next);
    } finally {
      setPending(false);
    }
  }

  const label = value ? `Remove ${accountName} from favourites` : `Add ${accountName} to favourites`;
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={value}
      aria-label={label}
      title={value ? 'Favourite' : 'Add to favourites'}
      className={`shrink-0 rounded-md transition-colors hover:bg-accent disabled:opacity-60 ${size === 'md' ? 'p-2' : 'p-1.5'} ${value ? '' : 'text-muted-foreground/50 hover:text-foreground'}`}
    >
      <FavoriteStar favorite={value} className={size === 'md' ? 'size-5' : 'size-4'} />
    </button>
  );
}
