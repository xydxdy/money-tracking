'use server';
import { z } from 'zod';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { parseTransactionFilters, transactionConditions, transactionOrder, type TransactionFilters } from '@/lib/transaction-query';
import { getCurrentUser } from '@/lib/session';
import { getUserTransaction } from '@/lib/authorization';

export async function listReimbursables(filters?: Pick<TransactionFilters, 'q' | 'status' | 'sort' | 'from' | 'to'>) {
  const user = await getCurrentUser();
  const f = parseTransactionFilters(filters);
  return db.select().from(transactions)
    .where(and(...transactionConditions(user.id, { q: f.q, status: f.status, from: f.from, to: f.to }), eq(transactions.reimbursable, true)))
    .orderBy(...transactionOrder(f.sort));
}

export async function setReimbursementStatus(id: string, status: 'to_claim' | 'submitting' | 'claimed') {
  const user = await getCurrentUser();
  status = z.enum(['to_claim', 'submitting', 'claimed']).parse(status);
  const existing = await getUserTransaction(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  const [updated] = await db.update(transactions).set({ reimbursementStatus: status, updatedAt: new Date() })
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id))).returning();
  return updated;
}
