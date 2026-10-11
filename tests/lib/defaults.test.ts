import { describe, it, expect, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users, accountTypes, categories } from '@/db/schema';
import { seedUserDefaults, DEFAULT_ACCOUNT_TYPES, DEFAULT_CATEGORIES } from '@/lib/defaults';

afterAll(async () => {
  await db.delete(categories);
  await db.delete(accountTypes);
  await db.delete(users);
});

describe('seedUserDefaults', () => {
  it('gives a user the default account types and categories, once', async () => {
    const [user] = await db.insert(users).values({ email: 'defaults@example.com', passwordHash: 'x' }).returning();
    await seedUserDefaults(user.id);
    await seedUserDefaults(user.id); // a second call must not duplicate anything

    const types = await db.select().from(accountTypes).where(eq(accountTypes.userId, user.id));
    const cats = await db.select().from(categories).where(eq(categories.userId, user.id));
    expect(types.map((t) => t.name).sort()).toEqual(DEFAULT_ACCOUNT_TYPES.map((t) => t.name).sort());
    expect(cats).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(new Set(cats.map((c) => c.type))).toEqual(new Set(['expense', 'income', 'transfer']));
    expect(types.every((t) => t.icon && !('color' in t))).toBe(true);
  });

  it('offers Travel card and no Grant among the default account types', () => {
    const names = DEFAULT_ACCOUNT_TYPES.map((t) => t.name);
    expect(names).toEqual(['Bank', 'Credit card', 'Cash', 'E-wallet', 'Travel card']);
  });
});
