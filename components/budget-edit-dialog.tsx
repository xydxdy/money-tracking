'use client';
import { EditDialog } from '@/components/edit-dialog';
import { BudgetForm } from '@/components/budget-form';
import type { Budget, Category } from '@/db/schema';

export function BudgetEditDialog({ budget, categories }: { budget: Budget; categories: Category[] }) {
  return (
    <EditDialog title="Edit budget">
      {(close) => <BudgetForm month={budget.month} categories={categories} existing={budget} onSaved={close} />}
    </EditDialog>
  );
}
