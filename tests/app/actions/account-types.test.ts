import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { eq } from 'drizzle-orm';
import { users, accounts, accountTypes } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { listAccountTypes, createAccountType, updateAccountType, deleteAccountType, addMissingDefaultAccountTypes } from '@/app/actions/account-types';
import { DEFAULT_ACCOUNT_TYPES } from '@/lib/defaults';
import { createAccount } from '@/app/actions/accounts';
import { FALLBACK_APPEARANCE } from '@/lib/account-appearance';

let user: { id: string; email: string };
let otherTypeId: string;

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'account-types@example.com', passwordHash: 'x' }).returning();
  const [other] = await db.insert(users).values({ email: 'account-types-other@example.com', passwordHash: 'x' }).returning();
  [{ id: otherTypeId }] = await db.insert(accountTypes).values({ userId: other.id, name: 'Theirs' }).returning();
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: user.id, email: user.email, name: null });
});

afterAll(async () => {
  await db.delete(accounts);
  await db.delete(accountTypes);
  await db.delete(users);
});

describe('account types', () => {
  it('creates, lists (by name) and edits account types', async () => {
    await createAccountType({ name: 'Savings', icon: 'piggy-bank' });
    const broker = await createAccountType({ name: 'brokerage', icon: 'trending-up' });
    expect((await listAccountTypes()).map((t) => t.name)).toEqual(['Bank', 'brokerage', 'Cash', 'Savings']); // Bank and Cash always exist
    const renamed = await updateAccountType(broker.id, { name: 'Investments' });
    expect(renamed).toMatchObject({ name: 'Investments', icon: 'trending-up' });
    expect(renamed).not.toHaveProperty('color'); // account types have no colour
  });

  it('rejects a duplicate name (ignoring case)', async () => {
    await expect(createAccountType({ name: 'savings' })).rejects.toThrow('TYPE_EXISTS');
  });

  it('gives a new account its type, the type’s icon, and the default colour', async () => {
    const savings = (await listAccountTypes()).find((t) => t.name === 'Savings')!;
    const acc = await createAccount({ name: 'Rainy day', accountTypeId: savings.id, currency: 'USD', startingBalance: '0' });
    expect(acc).toMatchObject({ accountTypeId: savings.id, icon: 'piggy-bank', color: FALLBACK_APPEARANCE.color });
  });

  it("refuses another user's account type", async () => {
    await expect(createAccount({ name: 'X', accountTypeId: otherTypeId, currency: 'USD', startingBalance: '0' })).rejects.toThrow('FORBIDDEN');
    await expect(updateAccountType(otherTypeId, { name: 'Hijack' })).rejects.toThrow('NOT_FOUND');
    await expect(deleteAccountType(otherTypeId)).rejects.toThrow('NOT_FOUND');
  });

  it('deletes a type in use by moving its accounts to Bank', async () => {
    const savings = (await listAccountTypes()).find((t) => t.name === 'Savings')!;
    const moved = await deleteAccountType(savings.id);
    expect(moved).toBe(1);
    const types = await listAccountTypes();
    expect(types.some((t) => t.name === 'Savings')).toBe(false);
    const bank = types.find((t) => t.name === 'Bank')!;
    const [acc] = await db.select().from(accounts).where(eq(accounts.name, 'Rainy day'));
    expect(acc.accountTypeId).toBe(bank.id);
  });

  it('deletes an unused type', async () => {
    const temp = await createAccountType({ name: 'Temporary' });
    expect(await deleteAccountType(temp.id)).toBe(0);
    expect((await listAccountTypes()).some((t) => t.name === 'Temporary')).toBe(false);
  });

  it('always has Bank and Cash, which cannot be edited or deleted', async () => {
    const types = await listAccountTypes();
    const bank = types.find((t) => t.name === 'Bank')!;
    const cash = types.find((t) => t.name === 'Cash')!;
    expect(bank).toBeDefined();
    expect(cash).toBeDefined();
    await expect(updateAccountType(bank.id, { name: 'Banks' })).rejects.toThrow('TYPE_PROTECTED');
    await expect(updateAccountType(cash.id, { icon: 'coins' })).rejects.toThrow('TYPE_PROTECTED');
    await expect(deleteAccountType(bank.id)).rejects.toThrow('TYPE_PROTECTED');
    await expect(deleteAccountType(cash.id)).rejects.toThrow('TYPE_PROTECTED');
  });

  it('adds only the default types the user is missing (matching names ignoring case)', async () => {
    await createAccountType({ name: 'credit CARD' });
    const added = await addMissingDefaultAccountTypes();
    // Bank and Cash always exist and "Credit card" matches ignoring case, so only the rest are added.
    expect(added).toBe(DEFAULT_ACCOUNT_TYPES.length - 3);
    const names = (await listAccountTypes()).map((t) => t.name.toLowerCase());
    for (const d of DEFAULT_ACCOUNT_TYPES) expect(names.filter((n) => n === d.name.toLowerCase())).toHaveLength(1);
    expect(await addMissingDefaultAccountTypes()).toBe(0);
  });
});
