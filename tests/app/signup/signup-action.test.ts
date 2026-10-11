import { describe, it, expect, vi, afterAll, afterEach } from 'vitest';
import { db } from '@/db/client';
import { users, accountTypes, categories } from '@/db/schema';

vi.mock('@/lib/auth', () => ({ signIn: vi.fn() }));
vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }));
import { signIn } from '@/lib/auth';
import { signupAction } from '@/app/signup/actions';

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
const valid = { name: 'Sam', email: 'sam@example.com', password: 'sam-password', confirmPassword: 'sam-password' };

afterEach(() => { delete process.env.DISABLE_SIGNUP; vi.mocked(signIn).mockReset(); });
afterAll(async () => {
  await db.delete(categories);
  await db.delete(accountTypes);
  await db.delete(users);
});

describe('signupAction', () => {
  it('returns field errors for an invalid form without creating anyone', async () => {
    const res = await signupAction(undefined, form({ ...valid, email: 'bad', confirmPassword: 'other-password' }));
    expect(res.fieldErrors?.email).toBeTruthy();
    expect(res.fieldErrors?.confirmPassword).toMatch(/match/i);
    expect(signIn).not.toHaveBeenCalled();
  });

  it('creates the account and signs the new user in', async () => {
    await signupAction(undefined, form(valid));
    expect(signIn).toHaveBeenCalledWith('credentials', expect.objectContaining({ email: 'sam@example.com', redirectTo: '/dashboard' }));
  });

  it('says when the email is already registered', async () => {
    const res = await signupAction(undefined, form({ ...valid, email: 'SAM@example.com' }));
    expect(res.fieldErrors?.email).toMatch(/already exists/i);
  });

  it('refuses when sign-up is turned off', async () => {
    process.env.DISABLE_SIGNUP = 'true';
    const res = await signupAction(undefined, form({ ...valid, email: 'other@example.com' }));
    expect(res.error).toMatch(/turned off/i);
  });
});
