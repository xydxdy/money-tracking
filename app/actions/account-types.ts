'use server';
import { z } from 'zod';
import { and, asc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { accounts, accountTypes } from '@/db/schema';
import { getCurrentUser } from '@/lib/session';
import { DEFAULT_ACCOUNT_TYPES, PROTECTED_ACCOUNT_TYPES, isProtectedAccountType } from '@/lib/defaults';
import { iconName } from '@/lib/icon-schema';

const typeInput = z.object({
  name: z.string().trim().min(1).max(60),
  icon: iconName,
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

/** Makes sure the user has the protected Bank and Cash types (recreating them if missing). */
async function ensureProtectedTypes(userId: string) {
  const have = new Set((await db.select({ name: accountTypes.name }).from(accountTypes).where(eq(accountTypes.userId, userId)))
    .map((t) => t.name.toLowerCase()));
  const missing = PROTECTED_ACCOUNT_TYPES.filter((t) => !have.has(t.name.toLowerCase()));
  if (missing.length > 0) {
    await db.insert(accountTypes).values(missing.map(({ name, icon }) => ({ userId, name, icon }))).onConflictDoNothing();
  }
}

export async function listAccountTypes() {
  const user = await getCurrentUser();
  await ensureProtectedTypes(user.id);
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
  const existing = await ownedType(id, user.id);
  if (isProtectedAccountType(existing.name)) throw new Error('TYPE_PROTECTED');
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

/**
 * Deletes an account type. Bank and Cash can't be deleted; accounts that used the type are moved
 * to Bank. Returns how many accounts were moved.
 */
export async function deleteAccountType(id: string) {
  const user = await getCurrentUser();
  const existing = await ownedType(id, user.id);
  if (isProtectedAccountType(existing.name)) throw new Error('TYPE_PROTECTED');
  await ensureProtectedTypes(user.id);
  const [bank] = await db.select().from(accountTypes)
    .where(and(eq(accountTypes.userId, user.id), eq(sql`lower(${accountTypes.name})`, 'bank'))).limit(1);
  const moved = await db.transaction(async (tx) => {
    const rows = await tx.update(accounts).set({ accountTypeId: bank.id, updatedAt: new Date() })
      .where(and(eq(accounts.accountTypeId, id), eq(accounts.userId, user.id))).returning({ id: accounts.id });
    await tx.delete(accountTypes).where(and(eq(accountTypes.id, id), eq(accountTypes.userId, user.id)));
    return rows.length;
  });
  revalidatePath('/settings/account-types');
  revalidatePath('/accounts');
  return moved;
}

/** Adds any of the default account types the user doesn't have yet; returns how many were added. */
export async function addMissingDefaultAccountTypes() {
  const user = await getCurrentUser();
  const have = new Set((await db.select({ name: accountTypes.name }).from(accountTypes).where(eq(accountTypes.userId, user.id)))
    .map((t) => t.name.toLowerCase()));
  const missing = DEFAULT_ACCOUNT_TYPES.filter((d) => !have.has(d.name.toLowerCase()));
  if (missing.length > 0) {
    await db.insert(accountTypes).values(missing.map(({ name, icon }) => ({ userId: user.id, name, icon })));
  }
  revalidatePath('/settings/account-types');
  return missing.length;
}
