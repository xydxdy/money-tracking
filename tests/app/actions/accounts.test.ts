import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, accounts } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { createAccount, listAccounts, setAccountArchived } from '@/app/actions/accounts';

let user: { id: string; email: string };

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'accounts-action@example.com', passwordHash: 'x' }).returning();
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: user.id, email: user.email, name: null });
});

afterAll(async () => {
  await db.delete(accounts);
  await db.delete(users);
});

describe('account actions', () => {
  it('creates an account scoped to the current user', async () => {
    const account = await createAccount({ name: 'Wallet', type: 'wallet', currency: 'USD', startingBalance: '0' });
    expect(account.userId).toBe(user.id);
  });

  it('lists only the current user accounts', async () => {
    const list = await listAccounts();
    expect(list.every((a) => a.userId === user.id)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('archives an account', async () => {
    const account = await createAccount({ name: 'Old Cash', type: 'cash', currency: 'USD', startingBalance: '0' });
    const updated = await setAccountArchived(account.id, true);
    expect(updated.archived).toBe(true);
  });
});
