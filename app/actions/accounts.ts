'use server';
import { z } from 'zod';
import { db } from '@/db/client';
import { accounts } from '@/db/schema';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/session';
import { getUserAccount } from '@/lib/authorization';
import { calculateAccountBalance } from '@/lib/balances';
import { ACCOUNT_COLOR_KEYS, FALLBACK_APPEARANCE } from '@/lib/account-appearance';
import { accountTypes } from '@/db/schema';
import { iconName } from '@/lib/icon-schema';

const accountInput = z.object({
  name: z.string().min(1),
  accountTypeId: z.string().min(1).nullable().optional(),
  currency: z.string().min(3).max(3),
  startingBalance: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  note: z.string().optional(),
  color: z.enum(ACCOUNT_COLOR_KEYS).optional(),
  icon: iconName,
});

async function ownedAccountType(userId: string, accountTypeId: string | null | undefined) {
  if (!accountTypeId) return null;
  const [type] = await db.select().from(accountTypes)
    .where(and(eq(accountTypes.id, accountTypeId), eq(accountTypes.userId, userId))).limit(1);
  if (!type) throw new Error('FORBIDDEN');
  return type;
}

export async function createAccount(input: z.infer<typeof accountInput>) {
  const user = await getCurrentUser();
  const data = accountInput.parse(input);
  const type = await ownedAccountType(user.id, data.accountTypeId);
  // A new account takes its type's icon (and the default colour) unless the user chose their own.
  const defaults = { icon: type?.icon ?? FALLBACK_APPEARANCE.icon, color: FALLBACK_APPEARANCE.color };
  const [account] = await db.insert(accounts).values({
    ...data, color: data.color ?? defaults.color, icon: data.icon ?? defaults.icon, userId: user.id,
  }).returning();
  return account;
}

export async function updateAccount(id: string, input: Partial<z.infer<typeof accountInput>>) {
  const user = await getCurrentUser();
  const existing = await getUserAccount(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  const data = accountInput.partial().parse(input);
  if (data.accountTypeId) await ownedAccountType(user.id, data.accountTypeId);
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
  return db.select().from(accounts).where(eq(accounts.userId, user.id))
    .orderBy(sql`${accounts.position} asc nulls last`, asc(accounts.currency), asc(sql`lower(${accounts.name})`));
}

/** Saves a drag-and-drop order: `ids` is the full list of the user's account ids, in display order. */
export async function reorderAccounts(ids: string[]) {
  const user = await getCurrentUser();
  const parsed = z.array(z.string()).parse(ids);
  if (new Set(parsed).size !== parsed.length) throw new Error('INVALID');
  if (parsed.length > 0) {
    const owned = await db.select({ id: accounts.id }).from(accounts)
      .where(and(eq(accounts.userId, user.id), inArray(accounts.id, parsed)));
    if (owned.length !== parsed.length) throw new Error('FORBIDDEN');
  }
  await db.transaction(async (tx) => {
    for (const [position, id] of parsed.entries()) {
      await tx.update(accounts).set({ position })
        .where(and(eq(accounts.id, id), eq(accounts.userId, user.id)));
    }
  });
  revalidatePath('/accounts');
}

export async function getAccountWithBalance(id: string) {
  const user = await getCurrentUser();
  const account = await getUserAccount(id, user.id);
  if (!account) throw new Error('NOT_FOUND');
  const balance = await calculateAccountBalance(id, user.id);
  return { account, balance };
}
