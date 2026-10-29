'use server';
import { z } from 'zod';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { accountGroups, accounts } from '@/db/schema';
import { getCurrentUser } from '@/lib/session';
import { getUserAccount } from '@/lib/authorization';
import { ACCOUNT_COLOR_KEYS } from '@/lib/account-appearance';
import { iconName } from '@/lib/icon-schema';

const groupInput = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.enum(ACCOUNT_COLOR_KEYS).optional(),
  icon: iconName,
  note: z.string().max(200).optional(),
});

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
}

async function ownedGroup(id: string, userId: string) {
  const [row] = await db.select().from(accountGroups).where(and(eq(accountGroups.id, id), eq(accountGroups.userId, userId))).limit(1);
  if (!row) throw new Error('NOT_FOUND');
  return row;
}

export async function listAccountGroups() {
  const user = await getCurrentUser();
  return db.select().from(accountGroups).where(eq(accountGroups.userId, user.id))
    .orderBy(sql`${accountGroups.position} asc nulls last`, asc(sql`lower(${accountGroups.name})`));
}

export async function createAccountGroup(input: z.input<typeof groupInput>) {
  const user = await getCurrentUser();
  const data = groupInput.parse(input);
  try {
    const [row] = await db.insert(accountGroups).values({ ...data, color: data.color ?? 'slate', userId: user.id }).returning();
    revalidatePath('/accounts');
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new Error('GROUP_EXISTS');
    throw err;
  }
}

export async function updateAccountGroup(id: string, input: Partial<z.input<typeof groupInput>>) {
  const user = await getCurrentUser();
  await ownedGroup(id, user.id);
  const data = groupInput.partial().parse(input);
  try {
    const [row] = await db.update(accountGroups).set({ ...data, updatedAt: new Date() })
      .where(and(eq(accountGroups.id, id), eq(accountGroups.userId, user.id))).returning();
    revalidatePath('/accounts');
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new Error('GROUP_EXISTS');
    throw err;
  }
}

/** Deletes a group; its accounts are kept and become ungrouped. */
export async function deleteAccountGroup(id: string) {
  const user = await getCurrentUser();
  await ownedGroup(id, user.id);
  await db.transaction(async (tx) => {
    await tx.update(accounts).set({ groupId: null, updatedAt: new Date() })
      .where(and(eq(accounts.groupId, id), eq(accounts.userId, user.id)));
    await tx.delete(accountGroups).where(and(eq(accountGroups.id, id), eq(accountGroups.userId, user.id)));
  });
  revalidatePath('/accounts');
}

/** Moves an account into a group, or out of any group when `groupId` is null. */
export async function moveAccountToGroup(accountId: string, groupId: string | null) {
  const user = await getCurrentUser();
  if (!(await getUserAccount(accountId, user.id))) throw new Error('NOT_FOUND');
  if (groupId) await ownedGroup(groupId, user.id).catch(() => { throw new Error('FORBIDDEN'); });
  const [updated] = await db.update(accounts).set({ groupId, updatedAt: new Date() })
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, user.id))).returning();
  revalidatePath('/accounts');
  return updated;
}

/** Saves a drag-and-drop order of groups: `ids` is the user's group ids in display order. */
export async function reorderAccountGroups(ids: string[]) {
  const user = await getCurrentUser();
  const parsed = z.array(z.string()).parse(ids);
  if (new Set(parsed).size !== parsed.length) throw new Error('INVALID');
  if (parsed.length > 0) {
    const owned = await db.select({ id: accountGroups.id }).from(accountGroups)
      .where(and(eq(accountGroups.userId, user.id), inArray(accountGroups.id, parsed)));
    if (owned.length !== parsed.length) throw new Error('FORBIDDEN');
  }
  await db.transaction(async (tx) => {
    for (const [position, id] of parsed.entries()) {
      await tx.update(accountGroups).set({ position })
        .where(and(eq(accountGroups.id, id), eq(accountGroups.userId, user.id)));
    }
  });
  revalidatePath('/accounts');
}
