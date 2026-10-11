'use client';
import { ActionsMenu } from '@/components/actions-menu';
import { BudgetForm } from '@/components/budget-form';
import type { Budget, Category } from '@/db/schema';

/** The "⋯" menu (Edit / Delete) for one budget. */
export function BudgetActions({ budget, categories, currencies, categoryName, monthLabel, onDelete }: {
  budget: Budget; categories: Category[]; currencies: string[]; categoryName: string; monthLabel: string; onDelete: () => Promise<void>;
}) {
  return (
    <ActionsMenu
      label={`the ${categoryName} budget`}
      editTitle="Edit budget"
      renderEdit={(close) => <BudgetForm month={budget.month} categories={categories} currencies={currencies} existing={budget} onSaved={close} />}
      deleteDescription={`Delete the ${categoryName} budget for ${monthLabel}? Transactions are not affected.`}
      confirmText={categoryName}
      onDelete={onDelete}
    />
  );
}
