'use client';
import { EditDialog } from '@/components/edit-dialog';
import { AccountForm } from '@/components/account-form';
import { CategoryForm } from '@/components/category-form';
import { BudgetForm } from '@/components/budget-form';
import { AccountTypeForm } from '@/components/account-type-form';
import type { Account, AccountType, Category } from '@/db/schema';

export function CreateAccountDialog({ types }: { types: AccountType[] }) {
  return (
    <EditDialog title="New account" triggerLabel="New account" create>
      {(close) => <AccountForm types={types} onSaved={close} />}
    </EditDialog>
  );
}

export function CreateCategoryDialog() {
  return (
    <EditDialog title="New category" triggerLabel="New category" create>
      {(close) => <CategoryForm onSaved={close} />}
    </EditDialog>
  );
}

export function CreateBudgetDialog({ month, monthLabel, categories, currencies, defaultCurrency, defaultCategoryId, triggerLabel = 'New budget', subtle = false }: {
  month: string; monthLabel: string; categories: Category[]; currencies: string[]; defaultCurrency?: string; defaultCategoryId?: string;
  triggerLabel?: string; subtle?: boolean;
}) {
  return (
    <EditDialog title={`New budget — ${monthLabel}`} triggerLabel={triggerLabel} create={!subtle}>
      {(close) => <BudgetForm month={month} categories={categories} currencies={currencies} defaultCurrency={defaultCurrency} defaultCategoryId={defaultCategoryId} onSaved={close} />}
    </EditDialog>
  );
}

export function EditAccountDialog({ account, types }: { account: Account; types: AccountType[] }) {
  return (
    <EditDialog title={`Edit ${account.name}`}>
      {(close) => <AccountForm existing={account} types={types} onSaved={close} />}
    </EditDialog>
  );
}

export function CreateAccountTypeDialog() {
  return (
    <EditDialog title="New account type" triggerLabel="New type" create>
      {(close) => <AccountTypeForm onSaved={close} />}
    </EditDialog>
  );
}
