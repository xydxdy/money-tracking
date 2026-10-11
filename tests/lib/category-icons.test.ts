import { describe, it, expect } from 'vitest';
import { CATEGORY_ICON_GROUPS, ALL_CATEGORY_ICONS, randomCategoryIcon } from '@/lib/category-icons';

describe('category icons', () => {
  it('offers a de-duplicated set of icons in named groups', () => {
    expect(CATEGORY_ICON_GROUPS.length).toBeGreaterThan(3);
    expect(ALL_CATEGORY_ICONS.length).toBeGreaterThan(40);
    expect(new Set(ALL_CATEGORY_ICONS).size).toBe(ALL_CATEGORY_ICONS.length);
  });

  it('picks a random icon from the set', () => {
    expect(randomCategoryIcon(() => 0)).toBe(ALL_CATEGORY_ICONS[0]);
    expect(randomCategoryIcon(() => 0.9999)).toBe(ALL_CATEGORY_ICONS.at(-1));
    for (let i = 0; i < 20; i++) expect(ALL_CATEGORY_ICONS).toContain(randomCategoryIcon());
  });

  it('can avoid repeating the current icon', () => {
    const first = ALL_CATEGORY_ICONS[0];
    expect(randomCategoryIcon(() => 0, first)).not.toBe(first);
  });
});
