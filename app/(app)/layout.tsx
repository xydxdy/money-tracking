import type { ReactNode } from 'react';
import { eq } from 'drizzle-orm';
import { Nav } from '@/components/nav';
import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { users } from '@/db/schema';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  // Read name/email from the database, not the session: the sign-in token keeps the old email
  // after it's changed in Settings → Profile.
  const [user] = session?.user?.id
    ? await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, session.user.id)).limit(1)
    : [];
  return (
    <div className="min-h-screen md:flex">
      <Nav email={user?.email ?? session?.user?.email} name={user?.name} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
