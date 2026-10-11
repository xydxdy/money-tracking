import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { seedUserDefaults } from '@/lib/defaults';

/** The sign-up form: name (optional), email, password (8+ characters) typed twice. */
export const signupInput = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
  confirmPassword: z.string(),
}).refine((v) => v.password === v.confirmPassword, { message: 'The passwords don’t match', path: ['confirmPassword'] });

/** Public sign-up is on unless DISABLE_SIGNUP=true. */
export function isSignupEnabled(env: Record<string, string | undefined> = process.env) {
  return env.DISABLE_SIGNUP !== 'true';
}

/**
 * Creates a user (email stored trimmed and lower-case, password hashed) together with the default
 * account types and categories, all in one transaction. Throws EMAIL_TAKEN if the email is already
 * registered (ignoring case). Used by the sign-up page and `npm run create-user`.
 */
export async function registerUser({ email, password, name }: { email: string; password: string; name?: string | null }) {
  const normalized = email.trim().toLowerCase();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, normalized)).limit(1);
  if (existing) throw new Error('EMAIL_TAKEN');
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ email: normalized, passwordHash, name: name?.trim() || null }).returning();
      await seedUserDefaults(user.id, tx);
      return user;
    });
  } catch (err) {
    // Two sign-ups racing for the same email: the unique constraint catches the second one.
    const e = err as { code?: string; cause?: { code?: string } };
    if (e?.code === '23505' || e?.cause?.code === '23505') throw new Error('EMAIL_TAKEN');
    throw err;
  }
}
