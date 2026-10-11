import { describe, it, expect, afterEach } from 'vitest';
import { createUser } from '@/scripts/create-user';
import { db } from '@/db/client';
import { users, accountTypes, categories } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

afterEach(async () => {
  const [u] = await db.select().from(users).where(eq(users.email, 'created@example.com'));
  if (u) {
    await db.delete(categories).where(eq(categories.userId, u.id));
    await db.delete(accountTypes).where(eq(accountTypes.userId, u.id));
  }
  await db.delete(users).where(eq(users.email, 'created@example.com'));
});

describe('createUser', () => {
  it('hashes the password and persists the user', async () => {
    const user = await createUser('created@example.com', 'plaintext-secret', 'Test User');
    expect(user.email).toBe('created@example.com');
    expect(user.passwordHash).not.toBe('plaintext-secret');
    expect(await bcrypt.compare('plaintext-secret', user.passwordHash)).toBe(true);
  });

  it('starts the new user with the default account types and categories', async () => {
    const user = await createUser('created@example.com', 'plaintext-secret');
    expect((await db.select().from(accountTypes).where(eq(accountTypes.userId, user.id))).length).toBeGreaterThan(0);
    expect((await db.select().from(categories).where(eq(categories.userId, user.id))).length).toBeGreaterThan(0);
  });
});
