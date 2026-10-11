'use server';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/session';
import { getUserTransaction } from '@/lib/authorization';

export async function listReimbursables() {
  const user = await getCurrentUser();
  return db.select().from(transactions).where(and(eq(transactions.userId, user.id), eq(transactions.reimbursable, true)));
}

export async function setReimbursementStatus(id: string, status: 'to_claim' | 'claimed' | 'reimbursed') {
  const user = await getCurrentUser();
  const existing = await getUserTransaction(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  const [updated] = await db.update(transactions).set({ reimbursementStatus: status, updatedAt: new Date() })
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id))).returning();
  return updated;
}
