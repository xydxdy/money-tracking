import { count, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { accounts } from '@/db/schema';
import { getCurrentUser } from '@/lib/session';
import { listAccountTypes, deleteAccountType, addMissingDefaultAccountTypes } from '@/app/actions/account-types';
import { DEFAULT_ACCOUNT_TYPES } from '@/lib/defaults';
import { Button } from '@/components/ui/button';
import { AccountAvatar } from '@/components/account-avatar';
import { ConfirmButton } from '@/components/confirm-button';
import { CreateAccountTypeDialog, EditAccountTypeDialog } from '@/components/create-dialogs';

export default async function AccountTypesPage() {
  const user = await getCurrentUser();
  const [types, usage] = await Promise.all([
    listAccountTypes(),
    db.select({ typeId: accounts.accountTypeId, n: count() }).from(accounts).where(eq(accounts.userId, user.id)).groupBy(accounts.accountTypeId),
  ]);
  const used = (id: string) => usage.find((u) => u.typeId === id)?.n ?? 0;
  const names = new Set(types.map((t) => t.name.toLowerCase()));
  const missingDefaults = DEFAULT_ACCOUNT_TYPES.filter((d) => !names.has(d.name.toLowerCase()));

  async function addDefaults() {
    'use server';
    await addMissingDefaultAccountTypes();
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">Account types</h2>
          <p className="text-sm text-muted-foreground">Group your accounts (Bank, Credit card, Savings…). A type in use can&apos;t be deleted.</p>
        </div>
        <div className="flex items-center gap-2">
          {missingDefaults.length > 0 && (
            <form action={addDefaults}>
              <Button type="submit" variant="outline" title={missingDefaults.map((d) => d.name).join(', ')}>
                Add default types ({missingDefaults.length})
              </Button>
            </form>
          )}
          <CreateAccountTypeDialog />
        </div>
      </div>
      <div className="divide-y overflow-hidden rounded-xl border bg-card shadow-xs">
        {types.map((t) => {
          const n = used(t.id);
          return (
            <div key={t.id} className="flex items-center justify-between gap-3 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <AccountAvatar icon={t.icon} color={t.color} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.name}</p>
                  <p className="text-sm text-muted-foreground">{n} {n === 1 ? 'account' : 'accounts'}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <EditAccountTypeDialog type={t} />
                {n === 0 && (
                  <ConfirmButton
                    label="Delete"
                    description={`Delete the "${t.name}" account type?`}
                    confirmText={t.name}
                    onConfirm={async () => { 'use server'; await deleteAccountType(t.id); }}
                  />
                )}
              </div>
            </div>
          );
        })}
        {types.length === 0 && <p className="p-4 text-sm text-muted-foreground">No account types yet. Create one to group your accounts.</p>}
      </div>
    </section>
  );
}
