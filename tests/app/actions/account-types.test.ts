import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, accountTypes } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { listAccountTypes, createAccountType, updateAccountType, deleteAccountType, addMissingDefaultAccountTypes } from '@/app/actions/account-types';
import { DEFAULT_ACCOUNT_TYPES } from '@/lib/defaults';
import { createAccount } from '@/app/actions/accounts';

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
    await createAccountType({ name: 'Savings', icon: '🐷', color: 'pink' });
    const broker = await createAccountType({ name: 'brokerage', icon: '📈', color: 'indigo' });
    expect((await listAccountTypes()).map((t) => t.name)).toEqual(['brokerage', 'Savings']);
    const renamed = await updateAccountType(broker.id, { name: 'Investments' });
    expect(renamed).toMatchObject({ name: 'Investments', icon: '📈', color: 'indigo' });
  });

  it('rejects a duplicate name (ignoring case) and an off-palette colour', async () => {
    await expect(createAccountType({ name: 'savings' })).rejects.toThrow('TYPE_EXISTS');
    await expect(createAccountType({ name: 'Odd', color: 'url(x)' as never })).rejects.toThrow();
  });

  it('gives a new account its type and the type’s icon and colour by default', async () => {
    const savings = (await listAccountTypes()).find((t) => t.name === 'Savings')!;
    const acc = await createAccount({ name: 'Rainy day', accountTypeId: savings.id, currency: 'USD', startingBalance: '0' });
    expect(acc).toMatchObject({ accountTypeId: savings.id, icon: '🐷', color: 'pink' });
  });

  it("refuses another user's account type", async () => {
    await expect(createAccount({ name: 'X', accountTypeId: otherTypeId, currency: 'USD', startingBalance: '0' })).rejects.toThrow('FORBIDDEN');
    await expect(updateAccountType(otherTypeId, { name: 'Hijack' })).rejects.toThrow('NOT_FOUND');
    await expect(deleteAccountType(otherTypeId)).rejects.toThrow('NOT_FOUND');
  });

  it('refuses to delete a type that accounts use, but deletes an unused one', async () => {
    const savings = (await listAccountTypes()).find((t) => t.name === 'Savings')!;
    await expect(deleteAccountType(savings.id)).rejects.toThrow('TYPE_IN_USE');
    const temp = await createAccountType({ name: 'Temporary' });
    await deleteAccountType(temp.id);
    expect((await listAccountTypes()).some((t) => t.name === 'Temporary')).toBe(false);
  });

  it('adds only the default types the user is missing (matching names ignoring case)', async () => {
    await createAccountType({ name: 'bank' });
    const added = await addMissingDefaultAccountTypes();
    expect(added).toBe(DEFAULT_ACCOUNT_TYPES.length - 1);
    const names = (await listAccountTypes()).map((t) => t.name.toLowerCase());
    for (const d of DEFAULT_ACCOUNT_TYPES) expect(names.filter((n) => n === d.name.toLowerCase())).toHaveLength(1);
    expect(await addMissingDefaultAccountTypes()).toBe(0);
  });
});
