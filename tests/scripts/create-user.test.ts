import { describe, it, expect, afterEach } from 'vitest';
import { createUser } from '@/scripts/create-user';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

afterEach(async () => {
  await db.delete(users).where(eq(users.email, 'created@example.com'));
});

describe('createUser', () => {
  it('hashes the password and persists the user', async () => {
    const user = await createUser('created@example.com', 'plaintext-secret', 'Test User');
    expect(user.email).toBe('created@example.com');
    expect(user.passwordHash).not.toBe('plaintext-secret');
    expect(await bcrypt.compare('plaintext-secret', user.passwordHash)).toBe(true);
  });
});
