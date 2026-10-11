import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, accounts } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { createAccount, updateAccount } from '@/app/actions/accounts';
import { ACCOUNT_COLORS, FALLBACK_APPEARANCE } from '@/lib/account-appearance';

beforeAll(async () => {
  const [user] = await db.insert(users).values({ email: 'account-appearance@example.com', passwordHash: 'x' }).returning();
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: user.id, email: user.email, name: null });
});

afterAll(async () => {
  await db.delete(accounts);
  await db.delete(users);
});

describe('account colour and icon', () => {
  it('falls back to a neutral icon and colour when the account has no type', async () => {
    const acc = await createAccount({ name: 'Untyped', currency: 'USD', startingBalance: '0' });
    expect(acc).toMatchObject(FALLBACK_APPEARANCE);
    expect(Object.keys(ACCOUNT_COLORS)).toContain(acc.color);
  });

  it('saves a chosen colour and icon', async () => {
    const acc = await createAccount({ name: 'Piggy', currency: 'THB', startingBalance: '0', color: 'pink', icon: '🐷' });
    expect(acc).toMatchObject({ color: 'pink', icon: '🐷' });
  });

  it('rejects a colour outside the palette', async () => {
    await expect(createAccount({ name: 'X', currency: 'USD', startingBalance: '0', color: 'red; background:url(x)' as never }))
      .rejects.toThrow();
  });

  it('edits name, colour, icon, starting balance and note without touching other fields', async () => {
    const acc = await createAccount({ name: 'Old', currency: 'USD', startingBalance: '1.00' });
    const updated = await updateAccount(acc.id, { name: 'New', color: 'teal', icon: '🏛️', startingBalance: '2.50', note: 'joint' });
    expect(updated).toMatchObject({ name: 'New', color: 'teal', icon: '🏛️', startingBalance: '2.50', note: 'joint', currency: 'USD' });
  });
});
