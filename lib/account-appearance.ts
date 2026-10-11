// Account colours are stored as a palette key, never as raw CSS, and each key maps to literal
// Tailwind classes here (Tailwind only generates classes it can see written out in full).
export const ACCOUNT_COLORS = {
  slate: { label: 'Slate', swatch: 'bg-slate-500', tile: 'bg-slate-500/15 text-slate-700 dark:text-slate-300', bar: 'bg-slate-500' },
  red: { label: 'Red', swatch: 'bg-red-500', tile: 'bg-red-500/15 text-red-700 dark:text-red-300', bar: 'bg-red-500' },
  orange: { label: 'Orange', swatch: 'bg-orange-500', tile: 'bg-orange-500/15 text-orange-700 dark:text-orange-300', bar: 'bg-orange-500' },
  amber: { label: 'Amber', swatch: 'bg-amber-500', tile: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', bar: 'bg-amber-500' },
  emerald: { label: 'Green', swatch: 'bg-emerald-500', tile: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500' },
  teal: { label: 'Teal', swatch: 'bg-teal-500', tile: 'bg-teal-500/15 text-teal-700 dark:text-teal-300', bar: 'bg-teal-500' },
  sky: { label: 'Sky', swatch: 'bg-sky-500', tile: 'bg-sky-500/15 text-sky-700 dark:text-sky-300', bar: 'bg-sky-500' },
  blue: { label: 'Blue', swatch: 'bg-blue-500', tile: 'bg-blue-500/15 text-blue-700 dark:text-blue-300', bar: 'bg-blue-500' },
  indigo: { label: 'Indigo', swatch: 'bg-indigo-500', tile: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300', bar: 'bg-indigo-500' },
  violet: { label: 'Violet', swatch: 'bg-violet-500', tile: 'bg-violet-500/15 text-violet-700 dark:text-violet-300', bar: 'bg-violet-500' },
  pink: { label: 'Pink', swatch: 'bg-pink-500', tile: 'bg-pink-500/15 text-pink-700 dark:text-pink-300', bar: 'bg-pink-500' },
} as const;

export type AccountColor = keyof typeof ACCOUNT_COLORS;
export const ACCOUNT_COLOR_KEYS = Object.keys(ACCOUNT_COLORS) as [AccountColor, ...AccountColor[]];

export const ACCOUNT_ICONS = [
  '🏦', '🏛️', '💳', '💵', '💴', '💶', '💷', '👛', '👜', '💰', '🐷', '🪙',
  '📈', '💼', '🎓', '✈️', '🌏', '🏠', '🚗', '📱', '🛒', '🎁', '❤️', '⭐',
];

/** Used when an account has no type (or its type has no icon/colour). */
export const FALLBACK_APPEARANCE: { icon: string; color: AccountColor } = { icon: '🏦', color: 'slate' };

/** Classes for a colour key, falling back to slate for an unknown/legacy value. */
export function accountColorClasses(color: string | null | undefined) {
  return ACCOUNT_COLORS[(color ?? '') as AccountColor] ?? ACCOUNT_COLORS.slate;
}
