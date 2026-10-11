'use client';
import { ActionsMenu } from '@/components/actions-menu';
import { CategoryForm } from '@/components/category-form';
import type { Category } from '@/db/schema';

/** The "⋯" menu (Edit / Delete) for one category. */
export function CategoryActions({ category, onDelete }: { category: Category; onDelete: () => Promise<void> }) {
  return (
    <ActionsMenu
      label={`the ${category.name} category`}
      editTitle={`Edit ${category.name}`}
      renderEdit={(close) => <CategoryForm existing={category} onSaved={close} />}
      deleteDescription={`Delete "${category.name}"? Historical transactions keep their data but lose this category, and its budgets are removed.`}
      confirmText={category.name}
      onDelete={onDelete}
    />
  );
}
