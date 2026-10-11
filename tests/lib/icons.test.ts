import { describe, it, expect } from 'vitest';
import { ICONS, ICON_NAMES, CATEGORY_ICON_GROUPS, ACCOUNT_ICON_NAMES, toIconName } from '@/lib/icons';
import { DEFAULT_ACCOUNT_TYPES, LEGACY_ACCOUNT_TYPES, DEFAULT_CATEGORIES } from '@/lib/defaults';
import { FALLBACK_APPEARANCE } from '@/lib/account-appearance';

describe('icon registry', () => {
  it('only offers icons that exist in the registry', () => {
    for (const g of CATEGORY_ICON_GROUPS) for (const name of g.icons) expect(ICONS[name]).toBeDefined();
    for (const name of ACCOUNT_ICON_NAMES) expect(ICONS[name]).toBeDefined();
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
  });

  it('uses registry icons (not emoji) for every default', () => {
    for (const t of [...DEFAULT_ACCOUNT_TYPES, ...LEGACY_ACCOUNT_TYPES]) expect(ICON_NAMES).toContain(t.icon);
    for (const c of DEFAULT_CATEGORIES) expect(ICON_NAMES).toContain(c.icon);
    expect(ICON_NAMES).toContain(FALLBACK_APPEARANCE.icon);
  });
});

describe('toIconName', () => {
  it('keeps icon names as they are', () => {
    expect(toIconName('shopping-cart')).toBe('shopping-cart');
  });

  it('translates the emoji used by older data and backups', () => {
    expect(toIconName('🛒')).toBe('shopping-cart');
    expect(toIconName('🏦')).toBe('landmark');
    expect(toIconName('✈️')).toBe('plane');
    expect(toIconName('✈')).toBe('plane'); // without the emoji variation selector
    expect(toIconName('☕')).toBe('coffee');
  });

  it('returns null for anything unknown or empty', () => {
    expect(toIconName('🦄')).toBeNull();
    expect(toIconName('not-an-icon')).toBeNull();
    expect(toIconName('')).toBeNull();
    expect(toIconName(null)).toBeNull();
  });
});
