'use client';
import { EditDialog } from '@/components/edit-dialog';
import { CategoryForm } from '@/components/category-form';
import type { Category } from '@/db/schema';

export function CategoryEditDialog({ category }: { category: Category }) {
  return (
    <EditDialog title={`Edit ${category.name}`}>
      {(close) => <CategoryForm existing={category} onSaved={close} />}
    </EditDialog>
  );
}
