import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, categories, transactions } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { GET } from '@/app/api/export/route';

let user: { id: string; email: string };

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'export-route@example.com', passwordHash: 'x' }).returning();
  const [acc] = await db.insert(accounts).values({ userId: user.id, name: 'Checking', currency: 'USD', startingBalance: '10.00' }).returning();
  const [cat] = await db.insert(categories).values({ userId: user.id, name: 'Food', type: 'expense' }).returning();
  await db.insert(transactions).values({
    userId: user.id, details: 'Lunch', type: 'expense', payDate: '2026-10-01', fromAccountId: acc.id, categoryId: cat.id,
    amount: '5.00', currency: 'USD', link: 'https://example.com/r.pdf', reimbursable: true, reimbursementStatus: 'submitting',
  });
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(categories);
  await db.delete(accounts);
  await db.delete(users);
});

describe('GET /api/export', () => {
  it("downloads the signed-in user's data as a JSON attachment", async () => {
    (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: user.id, email: user.email, name: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="money-tracking-export-\d{4}-\d{2}-\d{2}\.json"$/);
    const body = await res.json();
    expect(body.version).toBe(2);
    expect(body.accounts.map((a: { name: string }) => a.name)).toEqual(['Checking']);
    expect(body.categories).toEqual([expect.objectContaining({ name: 'Food', type: 'expense' })]);
    expect(body.transactions[0]).toMatchObject({ details: 'Lunch', link: 'https://example.com/r.pdf', reimbursementStatus: 'submitting' });
  });

  it('returns 401 when not signed in', async () => {
    (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('UNAUTHENTICATED'));
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
