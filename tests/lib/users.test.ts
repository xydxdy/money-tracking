import { describe, it, expect, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users, accountTypes, categories } from '@/db/schema';
import { registerUser, signupInput, isSignupEnabled } from '@/lib/users';

afterAll(async () => {
  await db.delete(categories);
  await db.delete(accountTypes);
  await db.delete(users);
});

describe('registerUser', () => {
  it('creates the user with a hashed password, a lower-case email and the default types and categories', async () => {
    const user = await registerUser({ name: 'New Person', email: '  New.Person@Example.com ', password: 'a-long-password' });
    expect(user.email).toBe('new.person@example.com');
    expect(user.name).toBe('New Person');
    expect(await bcrypt.compare('a-long-password', user.passwordHash)).toBe(true);
    expect((await db.select().from(accountTypes).where(eq(accountTypes.userId, user.id))).length).toBeGreaterThan(0);
    expect((await db.select().from(categories).where(eq(categories.userId, user.id))).length).toBeGreaterThan(0);
  });

  it('refuses an email that is already registered, ignoring case', async () => {
    await expect(registerUser({ email: 'NEW.PERSON@example.com', password: 'another-password' })).rejects.toThrow('EMAIL_TAKEN');
  });
});

describe('signupInput', () => {
  const base = { name: 'A', email: 'a@example.com', password: 'longenough', confirmPassword: 'longenough' };
  it('accepts a valid form', () => {
    expect(signupInput.safeParse(base).success).toBe(true);
  });
  it('rejects a bad email, a short password and mismatched passwords', () => {
    expect(signupInput.safeParse({ ...base, email: 'nope' }).success).toBe(false);
    expect(signupInput.safeParse({ ...base, password: 'short', confirmPassword: 'short' }).success).toBe(false);
    const mismatch = signupInput.safeParse({ ...base, confirmPassword: 'different!' });
    expect(mismatch.success).toBe(false);
    expect(mismatch.error?.issues[0].message).toMatch(/match/i);
  });
});

describe('isSignupEnabled', () => {
  it('is on unless DISABLE_SIGNUP is "true"', () => {
    expect(isSignupEnabled({})).toBe(true);
    expect(isSignupEnabled({ DISABLE_SIGNUP: 'false' })).toBe(true);
    expect(isSignupEnabled({ DISABLE_SIGNUP: 'true' })).toBe(false);
  });
});
