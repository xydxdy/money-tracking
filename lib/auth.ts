import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { SHORT_SESSION_MS } from '@/lib/remember-me';

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        remember: { label: 'Remember me', type: 'checkbox' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        // Emails are matched ignoring case (and surrounding spaces).
        const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email.trim().toLowerCase())).limit(1);
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined, remember: credentials?.remember === 'true' };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.remember = (user as { remember?: boolean }).remember ?? false;
        if (!token.remember) token.expiresAt = Date.now() + SHORT_SESSION_MS;
      }
      // Non-remembered sessions have a hard lifetime; returning null signs out.
      if (typeof token.expiresAt === 'number' && Date.now() > token.expiresAt) return null;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.userId as string;
      return Object.assign(session, { remember: token.remember !== false });
    },
  },
});
