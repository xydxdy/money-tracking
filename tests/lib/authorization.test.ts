import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, categories } from '@/db/schema';
import { getUserAccount } from '@/lib/authorization';

let userA: { id: string }, userB: { id: string };
let accountA: { id: string };

beforeAll(async () => {
  [userA] = await db.insert(users).values({ email: 'auth-a@example.com', passwordHash: 'x' }).returning();
  [userB] = await db.insert(users).values({ email: 'auth-b@example.com', passwordHash: 'x' }).returning();
  [accountA] = await db.insert(accounts).values({
    userId: userA.id, name: 'A Bank', type: 'bank', currency: 'USD', startingBalance: '0',
  }).returning();
});

afterAll(async () => {
  await db.delete(accounts);
  await db.delete(categories);
  await db.delete(users);
});

describe('getUserAccount', () => {
  it('returns the account when owned by the requesting user', async () => {
    const found = await getUserAccount(accountA.id, userA.id);
    expect(found?.id).toBe(accountA.id);
  });

  it('returns null when the account belongs to another user', async () => {
    const found = await getUserAccount(accountA.id, userB.id);
    expect(found).toBeNull();
  });
});
