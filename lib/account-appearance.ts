// Account colours are stored as a palette key, never as raw CSS, and each key maps to literal
// Tailwind classes here (Tailwind only generates classes it can see written out in full).
export const ACCOUNT_COLORS = {
  slate: { label: 'Slate', swatch: 'bg-slate-500', tile: 'bg-slate-500/15 text-slate-700 dark:text-slate-300', bar: 'bg-slate-500' },
  zinc: { label: 'Zinc', swatch: 'bg-zinc-500', tile: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300', bar: 'bg-zinc-500' },
  stone: { label: 'Stone', swatch: 'bg-stone-500', tile: 'bg-stone-500/15 text-stone-700 dark:text-stone-300', bar: 'bg-stone-500' },
  red: { label: 'Red', swatch: 'bg-red-500', tile: 'bg-red-500/15 text-red-700 dark:text-red-300', bar: 'bg-red-500' },
  orange: { label: 'Orange', swatch: 'bg-orange-500', tile: 'bg-orange-500/15 text-orange-700 dark:text-orange-300', bar: 'bg-orange-500' },
  amber: { label: 'Amber', swatch: 'bg-amber-500', tile: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', bar: 'bg-amber-500' },
  yellow: { label: 'Yellow', swatch: 'bg-yellow-500', tile: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300', bar: 'bg-yellow-500' },
  lime: { label: 'Lime', swatch: 'bg-lime-500', tile: 'bg-lime-500/15 text-lime-700 dark:text-lime-300', bar: 'bg-lime-500' },
  green: { label: 'Green', swatch: 'bg-green-500', tile: 'bg-green-500/15 text-green-700 dark:text-green-300', bar: 'bg-green-500' },
  emerald: { label: 'Emerald', swatch: 'bg-emerald-500', tile: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500' },
  teal: { label: 'Teal', swatch: 'bg-teal-500', tile: 'bg-teal-500/15 text-teal-700 dark:text-teal-300', bar: 'bg-teal-500' },
  cyan: { label: 'Cyan', swatch: 'bg-cyan-500', tile: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300', bar: 'bg-cyan-500' },
  sky: { label: 'Sky', swatch: 'bg-sky-500', tile: 'bg-sky-500/15 text-sky-700 dark:text-sky-300', bar: 'bg-sky-500' },
  blue: { label: 'Blue', swatch: 'bg-blue-500', tile: 'bg-blue-500/15 text-blue-700 dark:text-blue-300', bar: 'bg-blue-500' },
  indigo: { label: 'Indigo', swatch: 'bg-indigo-500', tile: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300', bar: 'bg-indigo-500' },
  violet: { label: 'Violet', swatch: 'bg-violet-500', tile: 'bg-violet-500/15 text-violet-700 dark:text-violet-300', bar: 'bg-violet-500' },
  purple: { label: 'Purple', swatch: 'bg-purple-500', tile: 'bg-purple-500/15 text-purple-700 dark:text-purple-300', bar: 'bg-purple-500' },
  fuchsia: { label: 'Fuchsia', swatch: 'bg-fuchsia-500', tile: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300', bar: 'bg-fuchsia-500' },
  pink: { label: 'Pink', swatch: 'bg-pink-500', tile: 'bg-pink-500/15 text-pink-700 dark:text-pink-300', bar: 'bg-pink-500' },
  rose: { label: 'Rose', swatch: 'bg-rose-500', tile: 'bg-rose-500/15 text-rose-700 dark:text-rose-300', bar: 'bg-rose-500' },
} as const;

export type AccountColor = keyof typeof ACCOUNT_COLORS;
export const ACCOUNT_COLOR_KEYS = Object.keys(ACCOUNT_COLORS) as [AccountColor, ...AccountColor[]];

export { ACCOUNT_ICON_NAMES as ACCOUNT_ICONS } from '@/lib/icons';

/** A new account's look when nothing else is chosen: its type's icon (or this one) and this colour. */
export const FALLBACK_APPEARANCE: { icon: string; color: AccountColor } = { icon: 'landmark', color: 'blue' };

/** Classes for a colour key, falling back to slate for an unknown/legacy value. */
export function accountColorClasses(color: string | null | undefined) {
  return ACCOUNT_COLORS[(color ?? '') as AccountColor] ?? ACCOUNT_COLORS.slate;
}
