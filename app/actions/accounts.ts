'use server';
import { z } from 'zod';
import { db } from '@/db/client';
import { accounts } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/session';
import { getUserAccount } from '@/lib/authorization';
import { calculateAccountBalance } from '@/lib/balances';

const accountInput = z.object({
  name: z.string().min(1),
  type: z.enum(['bank', 'credit', 'cash', 'wallet', 'travel', 'grant']),
  currency: z.string().min(3).max(3),
  startingBalance: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  note: z.string().optional(),
});

export async function createAccount(input: z.infer<typeof accountInput>) {
  const user = await getCurrentUser();
  const data = accountInput.parse(input);
  const [account] = await db.insert(accounts).values({ ...data, userId: user.id }).returning();
  return account;
}

export async function updateAccount(id: string, input: Partial<z.infer<typeof accountInput>>) {
  const user = await getCurrentUser();
  const existing = await getUserAccount(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  const data = accountInput.partial().parse(input);
  const [updated] = await db.update(accounts).set({ ...data, updatedAt: new Date() })
    .where(and(eq(accounts.id, id), eq(accounts.userId, user.id))).returning();
  return updated;
}

export async function setAccountArchived(id: string, archived: boolean) {
  const user = await getCurrentUser();
  const existing = await getUserAccount(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  const [updated] = await db.update(accounts).set({ archived, updatedAt: new Date() })
    .where(and(eq(accounts.id, id), eq(accounts.userId, user.id))).returning();
  return updated;
}

export async function listAccounts() {
  const user = await getCurrentUser();
  return db.select().from(accounts).where(eq(accounts.userId, user.id));
}

export async function getAccountWithBalance(id: string) {
  const user = await getCurrentUser();
  const account = await getUserAccount(id, user.id);
  if (!account) throw new Error('NOT_FOUND');
  const balance = await calculateAccountBalance(id, user.id);
  return { account, balance };
}
