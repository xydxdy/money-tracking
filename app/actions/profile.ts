'use server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { and, eq, ne, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { getCurrentUser } from '@/lib/session';

async function currentRow() {
  const user = await getCurrentUser();
  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!row) throw new Error('NOT_FOUND');
  return row;
}

/** Email and password changes are confirmed with the current password. */
async function assertPassword(passwordHash: string, currentPassword: string) {
  if (!(await bcrypt.compare(currentPassword, passwordHash))) throw new Error('WRONG_PASSWORD');
}

export async function getProfile() {
  const row = await currentRow();
  return { name: row.name, email: row.email };
}

export async function updateName(input: { name: string }) {
  const row = await currentRow();
  const { name } = z.object({ name: z.string().trim().max(80) }).parse(input);
  await db.update(users).set({ name: name || null, updatedAt: new Date() }).where(eq(users.id, row.id));
  revalidatePath('/', 'layout');
}

export async function updateEmail(input: { email: string; currentPassword: string }) {
  const row = await currentRow();
  const { email, currentPassword } = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    currentPassword: z.string().min(1),
  }).parse(input);
  await assertPassword(row.passwordHash, currentPassword);
  const [taken] = await db.select({ id: users.id }).from(users)
    .where(and(eq(sql`lower(${users.email})`, email), ne(users.id, row.id))).limit(1);
  if (taken) throw new Error('EMAIL_TAKEN');
  await db.update(users).set({ email, updatedAt: new Date() }).where(eq(users.id, row.id));
  revalidatePath('/', 'layout');
}

export async function changePassword(input: { currentPassword: string; newPassword: string }) {
  const row = await currentRow();
  const { currentPassword, newPassword } = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, 'Use at least 8 characters').max(200),
  }).parse(input);
  await assertPassword(row.passwordHash, currentPassword);
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, row.id));
}
