import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, transactions } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { listReimbursables, setReimbursementStatus } from '@/app/actions/reimbursements';

let user: { id: string; email: string };
let txnId: string;
let otherTxnId: string;

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'reimb@example.com', passwordHash: 'x' }).returning();
  const [txn] = await db.insert(transactions).values({
    userId: user.id, details: 'Conference fee', type: 'expense', payDate: '2026-09-01',
    amount: '50.00', currency: 'USD', reimbursable: true, reimbursementStatus: 'to_claim',
  }).returning();
  txnId = txn.id;
  await db.insert(transactions).values({
    userId: user.id, details: 'Groceries', type: 'expense', payDate: '2026-09-02',
    amount: '10.00', currency: 'USD', reimbursable: false,
  });
  const [other] = await db.insert(users).values({ email: 'reimb-other@example.com', passwordHash: 'x' }).returning();
  const [otherTxn] = await db.insert(transactions).values({
    userId: other.id, details: 'Other user claim', type: 'expense', payDate: '2026-09-03',
    amount: '99.00', currency: 'USD', reimbursable: true, reimbursementStatus: 'to_claim',
  }).returning();
  otherTxnId = otherTxn.id;
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: user.id, email: user.email, name: null });
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(users);
});

describe('reimbursements', () => {
  it('lists only reimbursable transactions', async () => {
    const list = await listReimbursables();
    expect(list.map((t) => t.id)).toEqual([txnId]);
  });

  it('updates reimbursement status', async () => {
    const updated = await setReimbursementStatus(txnId, 'claimed');
    expect(updated.reimbursementStatus).toBe('claimed');
  });

  it("rejects updating another user's transaction", async () => {
    await expect(setReimbursementStatus(otherTxnId, 'reimbursed')).rejects.toThrow('NOT_FOUND');
  });
});
