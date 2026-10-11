import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { getProfile, updateName, updateEmail, changePassword } from '@/app/actions/profile';

let user: { id: string; email: string };

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'profile@example.com', name: 'Old Name', passwordHash: await bcrypt.hash('current-pass-1', 4) }).returning();
  await db.insert(users).values({ email: 'taken@example.com', passwordHash: 'x' });
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: user.id, email: user.email, name: null });
});

afterAll(async () => {
  await db.delete(users);
});

const row = async () => (await db.select().from(users).where(eq(users.id, user.id)))[0];

describe('profile settings', () => {
  it('returns the current name and email, never the password hash', async () => {
    const profile = await getProfile();
    expect(profile).toEqual({ name: 'Old Name', email: 'profile@example.com' });
  });

  it('changes the display name', async () => {
    await updateName({ name: '  New Name ' });
    expect((await row()).name).toBe('New Name');
  });

  it('changes the email only with the current password, and stores it trimmed in lower case', async () => {
    await expect(updateEmail({ email: 'new@example.com', currentPassword: 'wrong' })).rejects.toThrow('WRONG_PASSWORD');
    await updateEmail({ email: ' New@Example.com ', currentPassword: 'current-pass-1' });
    expect((await row()).email).toBe('new@example.com');
  });

  it("refuses an email another user already has, or that isn't an email", async () => {
    await expect(updateEmail({ email: 'TAKEN@example.com', currentPassword: 'current-pass-1' })).rejects.toThrow('EMAIL_TAKEN');
    await expect(updateEmail({ email: 'not-an-email', currentPassword: 'current-pass-1' })).rejects.toThrow();
  });

  it('changes the password only with the current one, and requires at least 8 characters', async () => {
    await expect(changePassword({ currentPassword: 'wrong', newPassword: 'brand-new-pass' })).rejects.toThrow('WRONG_PASSWORD');
    await expect(changePassword({ currentPassword: 'current-pass-1', newPassword: 'short' })).rejects.toThrow();
    await changePassword({ currentPassword: 'current-pass-1', newPassword: 'brand-new-pass' });
    const hash = (await row()).passwordHash;
    expect(await bcrypt.compare('brand-new-pass', hash)).toBe(true);
    expect(await bcrypt.compare('current-pass-1', hash)).toBe(false);
  });
});
