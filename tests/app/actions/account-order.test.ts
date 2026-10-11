import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, accounts } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { createAccount, listAccounts, reorderAccounts } from '@/app/actions/accounts';

let user: { id: string; email: string };
let otherAccount: { id: string };

function actAs(u: { id: string; email: string }) {
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: u.id, email: u.email, name: null });
}

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'account-order@example.com', passwordHash: 'x' }).returning();
  const [other] = await db.insert(users).values({ email: 'account-order-other@example.com', passwordHash: 'x' }).returning();
  [otherAccount] = await db.insert(accounts).values({ userId: other.id, name: 'Theirs', currency: 'USD', startingBalance: '0' }).returning();
  actAs(user);
  for (const [name, currency] of [['Zeta', 'USD'], ['Alpha', 'USD'], ['Kasikorn', 'THB'], ['Bangkok Bank', 'THB']]) {
    await createAccount({ name, currency, startingBalance: '0' });
  }
});

afterAll(async () => {
  await db.delete(accounts);
  await db.delete(users);
});

describe('account ordering', () => {
  it('lists accounts by currency, then name, by default', async () => {
    const names = (await listAccounts()).map((a) => a.name);
    expect(names).toEqual(['Bangkok Bank', 'Kasikorn', 'Alpha', 'Zeta']);
  });

  it('keeps a custom order after reordering', async () => {
    const list = await listAccounts();
    const byName = Object.fromEntries(list.map((a) => [a.name, a.id]));
    await reorderAccounts([byName.Zeta, byName.Kasikorn, byName.Alpha, byName['Bangkok Bank']]);
    expect((await listAccounts()).map((a) => a.name)).toEqual(['Zeta', 'Kasikorn', 'Alpha', 'Bangkok Bank']);
  });

  it('puts a newly created account after the custom-ordered ones', async () => {
    await createAccount({ name: 'Aardvark', currency: 'AUD', startingBalance: '0' });
    expect((await listAccounts()).map((a) => a.name).at(-1)).toBe('Aardvark');
  });

  it("rejects reordering with another user's account id", async () => {
    const ids = (await listAccounts()).map((a) => a.id);
    await expect(reorderAccounts([otherAccount.id, ...ids])).rejects.toThrow('FORBIDDEN');
  });
});
