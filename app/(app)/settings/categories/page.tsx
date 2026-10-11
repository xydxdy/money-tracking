import { listCategories, deleteCategory } from '@/app/actions/categories';
import { CreateCategoryDialog } from '@/components/create-dialogs';
import { ConfirmButton } from '@/components/confirm-button';
import { CategoryEditDialog } from '@/components/category-edit-dialog';
import { Badge } from '@/components/ui/badge';
import type { Category } from '@/db/schema';

function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {categories.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3 shadow-xs">
          <span className="flex min-w-0 items-center gap-3">
            <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">{c.icon || '🏷️'}</span>
            <span className="truncate font-medium">{c.name}</span>
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {c.archived && <Badge variant="secondary">Archived</Badge>}
            <CategoryEditDialog category={c} />
            <ConfirmButton
              label="Delete"
              description={`Delete "${c.name}"? Historical transactions keep their data but lose this category, and its budgets are removed.`}
              confirmText={c.name}
              onConfirm={async () => { 'use server'; await deleteCategory(c.id); }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const TYPE_SECTIONS = [
  { type: 'expense', label: 'Expense' },
  { type: 'income', label: 'Income' },
  { type: 'transfer', label: 'Transfer' },
] as const;

export default async function CategoriesPage() {
  // Sorted A→Z by listCategories; grouped by type here.
  const categories = await listCategories();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">Categories <span className="text-sm font-normal text-muted-foreground">({categories.length})</span></h2>
          <p className="text-sm text-muted-foreground">Used to label transactions and to set budgets.</p>
        </div>
        <CreateCategoryDialog />
      </div>
      {categories.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">No categories yet. Use “New category” to create your first one.</p>
      ) : (
        TYPE_SECTIONS.map(({ type, label }) => {
          const inSection = categories.filter((c) => c.type === type);
          return (
            <section key={type} className="space-y-2">
              <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">{label} <span className="text-sm font-normal text-muted-foreground">({inSection.length})</span></h2>
              {inSection.length > 0 ? <CategoryGrid categories={inSection} /> : <p className="text-sm text-muted-foreground">None.</p>}
            </section>
          );
        })
      )}
    </div>
  );
}
