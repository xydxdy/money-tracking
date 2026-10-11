import { count, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts, budgets, categories, transactions } from '@/db/schema';
import { getCurrentUser } from '@/lib/session';
import { ImportForm } from '@/components/import-form';
import { DownloadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default async function DataSettingsPage() {
  const user = await getCurrentUser();
  const countFor = async (table: typeof accounts | typeof categories | typeof transactions | typeof budgets) => {
    const [row] = await db.select({ n: count() }).from(table).where(eq(table.userId, user.id));
    return row.n;
  };
  const [accountCount, categoryCount, transactionCount, budgetCount] = await Promise.all([
    countFor(accounts), countFor(categories), countFor(transactions), countFor(budgets),
  ]);

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border bg-card p-5 shadow-xs">
        <div>
          <h2 className="font-medium">Import backup</h2>
          <p className="text-sm text-muted-foreground">Importing a backup replaces all of your current data with the contents of the file.</p>
        </div>
        <ImportForm existing={{ accounts: accountCount, categories: categoryCount, transactions: transactionCount, budgets: budgetCount }} />
      </section>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5 shadow-xs">
        <div>
          <h2 className="font-medium">Export your data</h2>
          <p className="text-sm text-muted-foreground">Download everything as a JSON file you can import later.</p>
        </div>
        <form action="/api/export" method="get">
          <Button type="submit" variant="outline"><DownloadIcon /> Download export</Button>
        </form>
      </section>
    </div>
  );
}
