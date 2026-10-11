import { describe, it, expect } from 'vitest';
import { uuidv7, uuidv7Time } from '@/lib/uuid';

describe('uuidv7', () => {
  it('produces RFC 9562 version-7 UUIDs', () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('embeds the creation time', () => {
    const before = Date.now();
    const id = uuidv7();
    const t = uuidv7Time(id);
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(Date.now());
  });

  it('sorts in creation order, even for many ids made in the same millisecond', () => {
    const ids = Array.from({ length: 2000 }, () => uuidv7());
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('can be generated for a given time, staying ordered', () => {
    const a = uuidv7(Date.parse('2026-01-01T00:00:00Z'));
    const b = uuidv7(Date.parse('2026-01-02T00:00:00Z'));
    expect(a < b).toBe(true);
    expect(uuidv7Time(a)).toBe(Date.parse('2026-01-01T00:00:00Z'));
  });
});
