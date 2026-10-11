'use server';
import { z } from 'zod';
import { and, asc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { accounts, accountTypes } from '@/db/schema';
import { getCurrentUser } from '@/lib/session';
import { ACCOUNT_COLOR_KEYS } from '@/lib/account-appearance';
import { DEFAULT_ACCOUNT_TYPES } from '@/lib/defaults';

const typeInput = z.object({
  name: z.string().trim().min(1).max(60),
  icon: z.string().trim().min(1).max(16).optional(),
  color: z.enum(ACCOUNT_COLOR_KEYS).optional(),
});

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
}

async function ownedType(id: string, userId: string) {
  const [row] = await db.select().from(accountTypes).where(and(eq(accountTypes.id, id), eq(accountTypes.userId, userId))).limit(1);
  if (!row) throw new Error('NOT_FOUND');
  return row;
}

export async function listAccountTypes() {
  const user = await getCurrentUser();
  return db.select().from(accountTypes).where(eq(accountTypes.userId, user.id)).orderBy(asc(sql`lower(${accountTypes.name})`));
}

export async function createAccountType(input: z.input<typeof typeInput>) {
  const user = await getCurrentUser();
  const data = typeInput.parse(input);
  try {
    const [row] = await db.insert(accountTypes).values({ ...data, userId: user.id }).returning();
    revalidatePath('/settings/account-types');
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new Error('TYPE_EXISTS');
    throw err;
  }
}

export async function updateAccountType(id: string, input: Partial<z.input<typeof typeInput>>) {
  const user = await getCurrentUser();
  await ownedType(id, user.id);
  const data = typeInput.partial().parse(input);
  try {
    const [row] = await db.update(accountTypes).set({ ...data, updatedAt: new Date() })
      .where(and(eq(accountTypes.id, id), eq(accountTypes.userId, user.id))).returning();
    revalidatePath('/settings/account-types');
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new Error('TYPE_EXISTS');
    throw err;
  }
}

export async function deleteAccountType(id: string) {
  const user = await getCurrentUser();
  await ownedType(id, user.id);
  const [used] = await db.select({ id: accounts.id }).from(accounts)
    .where(and(eq(accounts.accountTypeId, id), eq(accounts.userId, user.id))).limit(1);
  if (used) throw new Error('TYPE_IN_USE');
  await db.delete(accountTypes).where(and(eq(accountTypes.id, id), eq(accountTypes.userId, user.id)));
  revalidatePath('/settings/account-types');
}

/** Adds any of the default account types the user doesn't have yet; returns how many were added. */
export async function addMissingDefaultAccountTypes() {
  const user = await getCurrentUser();
  const have = new Set((await db.select({ name: accountTypes.name }).from(accountTypes).where(eq(accountTypes.userId, user.id)))
    .map((t) => t.name.toLowerCase()));
  const missing = DEFAULT_ACCOUNT_TYPES.filter((d) => !have.has(d.name.toLowerCase()));
  if (missing.length > 0) {
    await db.insert(accountTypes).values(missing.map(({ name, icon, color }) => ({ userId: user.id, name, icon, color })));
  }
  revalidatePath('/settings/account-types');
  return missing.length;
}
