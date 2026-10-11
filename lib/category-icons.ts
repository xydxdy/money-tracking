// Emoji offered when creating or editing a category.
export const CATEGORY_ICON_GROUPS = [
  { label: 'Food & drink', icons: ['🍔', '🍕', '🍜', '🍣', '🥗', '🍱', '☕', '🧋', '🍺', '🛒', '🥖', '🍎'] },
  { label: 'Home & bills', icons: ['🏠', '🏡', '💡', '🔌', '🌐', '📱', '💧', '🔥', '🛋️', '🧹', '🧺', '🔧'] },
  { label: 'Transport & travel', icons: ['🚗', '⛽', '🚕', '🚌', '🚆', '✈️', '🏨', '🧳', '🛵', '🚲', '🗺️', '🅿️'] },
  { label: 'Shopping & fun', icons: ['🛍️', '👕', '👟', '🎁', '🎮', '🎬', '🎵', '📚', '🎨', '⚽', '🏋️', '💄'] },
  { label: 'Health & family', icons: ['💊', '🏥', '🦷', '👶', '🐶', '🐱', '💇', '🧘', '❤️', '🎓', '🏫', '✏️'] },
  { label: 'Money', icons: ['💰', '💵', '💳', '🏦', '📈', '💸', '🪙', '🧾', '💼', '🎉', '🤝', '🔁'] },
] as const;

export const ALL_CATEGORY_ICONS: string[] = Array.from(new Set(CATEGORY_ICON_GROUPS.flatMap((g) => g.icons)));

/** A random icon from the set; `avoid` skips the current one so "shuffle" always changes it. */
export function randomCategoryIcon(random: () => number = Math.random, avoid?: string): string {
  const pool = avoid ? ALL_CATEGORY_ICONS.filter((i) => i !== avoid) : ALL_CATEGORY_ICONS;
  return pool[Math.min(Math.floor(random() * pool.length), pool.length - 1)];
}
