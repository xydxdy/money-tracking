import { listCategories } from '@/app/actions/categories';
import { CategoryForm } from '@/components/category-form';
import { Badge } from '@/components/ui/badge';

export default async function CategoriesPage() {
  const categories = await listCategories();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Categories</h1>
      {categories.length === 0 ? (
        <p className="text-muted-foreground">No categories yet. Create your first one below.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
              <span>{c.icon} {c.name}</span>
              <div className="flex gap-1">
                <Badge variant="outline">{c.type}</Badge>
                {c.noBudget && <Badge variant="secondary">No budget</Badge>}
                {c.archived && <Badge variant="secondary">Archived</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
      <CategoryForm />
    </div>
  );
}
