import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, accounts } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { createAccount, setAccountFavorite } from '@/app/actions/accounts';
import { exportUserData } from '@/lib/export';
import { commitImport } from '@/lib/import/importer';

let user: { id: string; email: string };
let otherAccountId: string;

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'account-favorite@example.com', passwordHash: 'x' }).returning();
  const [other] = await db.insert(users).values({ email: 'account-favorite-other@example.com', passwordHash: 'x' }).returning();
  [{ id: otherAccountId }] = await db.insert(accounts).values({ userId: other.id, name: 'Theirs', currency: 'USD' }).returning();
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: user.id, email: user.email, name: null });
});

afterAll(async () => {
  await db.delete(accounts);
  await db.delete(users);
});

describe('favourite accounts', () => {
  it('starts not favourite and toggles on and off', async () => {
    const account = await createAccount({ name: 'Daily', currency: 'THB', startingBalance: '0' });
    expect(account.favorite).toBe(false);
    expect((await setAccountFavorite(account.id, true)).favorite).toBe(true);
    expect((await setAccountFavorite(account.id, false)).favorite).toBe(false);
  });

  it("refuses another user's account", async () => {
    await expect(setAccountFavorite(otherAccountId, true)).rejects.toThrow('NOT_FOUND');
  });

  it('survives a backup round-trip', async () => {
    const account = await createAccount({ name: 'Starred', currency: 'USD', startingBalance: '0' });
    await setAccountFavorite(account.id, true);
    const backup = await exportUserData(user.id);
    await commitImport(JSON.parse(JSON.stringify(backup)), user.id);
    const after = (await exportUserData(user.id)).accounts;
    expect(Object.fromEntries(after.map((a) => [a.name, a.favorite]))).toEqual({ Daily: false, Starred: true });
  });
});
