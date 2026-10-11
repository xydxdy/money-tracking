import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts } from '@/db/schema';
import { getCurrentUser } from '@/lib/session';
import { ImportForm } from '@/components/import-form';
import { Button } from '@/components/ui/button';

export default async function DataSettingsPage() {
  const user = await getCurrentUser();
  const existing = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, user.id)).limit(1);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Data</h1>
      <section className="space-y-2">
        <h2 className="font-medium">Import backup</h2>
        <ImportForm hasExistingData={existing.length > 0} />
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Export your data</h2>
        <form action="/api/export" method="get">
          <Button type="submit">Download export (JSON)</Button>
        </form>
      </section>
    </div>
  );
}
