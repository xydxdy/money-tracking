'use client';
import { ActionsMenu } from '@/components/actions-menu';
import { AccountTypeForm } from '@/components/account-type-form';
import type { AccountType } from '@/db/schema';

/** The "⋯" menu (Edit / Delete) for one account type; deleting moves its accounts to Bank. */
export function AccountTypeActions({ type, accountCount, onDelete }: { type: AccountType; accountCount: number; onDelete: () => Promise<void> }) {
  return (
    <ActionsMenu
      label={`the ${type.name} account type`}
      editTitle={`Edit ${type.name}`}
      renderEdit={(close) => <AccountTypeForm existing={type} onSaved={close} />}
      deleteDescription={accountCount === 0
        ? `Delete the "${type.name}" account type?`
        : `Delete the "${type.name}" account type? Its ${accountCount} ${accountCount === 1 ? 'account moves' : 'accounts move'} to Bank.`}
      confirmText={type.name}
      onDelete={onDelete}
    />
  );
}
