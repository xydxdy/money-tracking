'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/session';
import { calculateLoanSummary, calculateLoanHistory, setLoansClosed } from '@/lib/loans';

const personInput = z.object({ counterparty: z.string().trim().min(1).max(80), currency: z.string().length(3) });

export async function listLoanSummary() {
  const user = await getCurrentUser();
  return calculateLoanSummary(user.id);
}

export async function listLoanHistory() {
  const user = await getCurrentUser();
  return calculateLoanHistory(user.id);
}

/** Closes all of a person's open loans in one currency (settled or written off). */
export async function closeLoans(input: { counterparty: string; currency: string }) {
  const user = await getCurrentUser();
  const { counterparty, currency } = personInput.parse(input);
  const changed = await setLoansClosed(user.id, counterparty, currency, true);
  revalidatePath('/loans');
  return changed;
}

/** Reopens one closed batch of a person's loans (identified by when it was closed). */
export async function reopenLoans(input: { counterparty: string; currency: string; closedAt: string }) {
  const user = await getCurrentUser();
  const { counterparty, currency, closedAt } = personInput
    .extend({ closedAt: z.string().refine((v) => !Number.isNaN(Date.parse(v))) }).parse(input);
  const changed = await setLoansClosed(user.id, counterparty, currency, false, new Date(closedAt));
  revalidatePath('/loans');
  return changed;
}
