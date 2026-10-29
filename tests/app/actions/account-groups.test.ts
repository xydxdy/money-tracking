import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { eq } from 'drizzle-orm';
import { users, accounts, accountGroups } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import {
  listAccountGroups, createAccountGroup, updateAccountGroup, deleteAccountGroup, moveAccountToGroup, reorderAccountGroups,
} from '@/app/actions/account-groups';
import { createAccount, updateAccount } from '@/app/actions/accounts';
import { exportUserData } from '@/lib/export';
import { commitImport } from '@/lib/import/importer';

let user: { id: string; email: string };
let otherGroupId: string;
let otherAccountId: string;

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'account-groups@example.com', passwordHash: 'x' }).returning();
  const [other] = await db.insert(users).values({ email: 'account-groups-other@example.com', passwordHash: 'x' }).returning();
  [{ id: otherGroupId }] = await db.insert(accountGroups).values({ userId: other.id, name: 'Theirs' }).returning();
  [{ id: otherAccountId }] = await db.insert(accounts).values({ userId: other.id, name: 'Theirs', currency: 'USD' }).returning();
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: user.id, email: user.email, name: null });
});

afterAll(async () => {
  await db.delete(accounts);
  await db.delete(accountGroups);
  await db.delete(users);
});

describe('account groups', () => {
  it('creates, lists (by name) and edits groups', async () => {
    await createAccountGroup({ name: 'Kasikorn', icon: 'landmark', color: 'green' });
    const wise = await createAccountGroup({ name: 'bank of x', icon: 'landmark' });
    expect((await listAccountGroups()).map((g) => g.name)).toEqual(['bank of x', 'Kasikorn']);
    expect(wise.color).toBe('slate');
    expect(await updateAccountGroup(wise.id, { name: 'Wise', note: 'Multi-currency' })).toMatchObject({ name: 'Wise', note: 'Multi-currency' });
  });

  it('rejects a duplicate name (ignoring case)', async () => {
    await expect(createAccountGroup({ name: 'kasikorn' })).rejects.toThrow('GROUP_EXISTS');
  });

  it('holds accounts in different currencies', async () => {
    const [kasikorn] = (await listAccountGroups()).filter((g) => g.name === 'Kasikorn');
    await createAccount({ name: 'Savings THB', currency: 'THB', startingBalance: '100', groupId: kasikorn.id });
    await createAccount({ name: 'FCD USD', currency: 'USD', startingBalance: '5', groupId: kasikorn.id });
    const inGroup = await db.select().from(accounts).where(eq(accounts.groupId, kasikorn.id));
    expect(inGroup.map((a) => a.currency).sort()).toEqual(['THB', 'USD']);
  });

  it('moves accounts between groups and out of a group', async () => {
    const groups = await listAccountGroups();
    const wise = groups.find((g) => g.name === 'Wise')!;
    const account = await createAccount({ name: 'Loose', currency: 'EUR', startingBalance: '0' });
    expect((await moveAccountToGroup(account.id, wise.id)).groupId).toBe(wise.id);
    expect((await moveAccountToGroup(account.id, null)).groupId).toBeNull();
    expect((await updateAccount(account.id, { groupId: wise.id })).groupId).toBe(wise.id);
  });

  it("refuses another user's group or account", async () => {
    const account = await createAccount({ name: 'Mine', currency: 'USD', startingBalance: '0' });
    await expect(moveAccountToGroup(account.id, otherGroupId)).rejects.toThrow('FORBIDDEN');
    await expect(moveAccountToGroup(otherAccountId, null)).rejects.toThrow('NOT_FOUND');
    await expect(createAccount({ name: 'Sneaky', currency: 'USD', startingBalance: '0', groupId: otherGroupId })).rejects.toThrow('FORBIDDEN');
    await expect(updateAccountGroup(otherGroupId, { name: 'Hacked' })).rejects.toThrow('NOT_FOUND');
    await expect(deleteAccountGroup(otherGroupId)).rejects.toThrow('NOT_FOUND');
    await expect(reorderAccountGroups([otherGroupId])).rejects.toThrow('FORBIDDEN');
  });

  it('keeps a custom group order', async () => {
    const ids = (await listAccountGroups()).map((g) => g.id).reverse();
    await reorderAccountGroups(ids);
    expect((await listAccountGroups()).map((g) => g.id)).toEqual(ids);
  });

  it('round-trips groups through a backup', async () => {
    const backup = await exportUserData(user.id);
    expect(backup.groups.map((g) => g.name).sort()).toEqual(['Kasikorn', 'Wise']);
    await commitImport(JSON.parse(JSON.stringify(backup)), user.id);
    const groups = await listAccountGroups();
    const kasikorn = groups.find((g) => g.name === 'Kasikorn')!;
    const inGroup = await db.select().from(accounts).where(eq(accounts.groupId, kasikorn.id));
    expect(inGroup.map((a) => a.name).sort()).toEqual(['FCD USD', 'Savings THB']);
  });

  it('deleting a group keeps its accounts, ungrouped', async () => {
    const kasikorn = (await listAccountGroups()).find((g) => g.name === 'Kasikorn')!;
    await deleteAccountGroup(kasikorn.id);
    const rows = await db.select().from(accounts).where(eq(accounts.userId, user.id));
    expect(rows.filter((a) => a.name === 'Savings THB' || a.name === 'FCD USD').map((a) => a.groupId)).toEqual([null, null]);
    expect((await listAccountGroups()).map((g) => g.name)).not.toContain('Kasikorn');
  });
});
