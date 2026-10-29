'use client';
import { AppIcon } from '@/components/app-icon';
import type { Category } from '@/db/schema';

/** Tap-to-pick category chips; tapping the chosen one again clears it. Submitted under `name`. */
export function CategoryChips({ name, categories, value, onChange }: {
  name: string; categories: Category[]; value: string; onChange: (id: string) => void;
}) {
  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No categories for this type yet. <a href="/settings/categories" className="text-primary hover:underline">Add one</a>
      </p>
    );
  }
  return (
    <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-1.5">
      <input type="hidden" name={name} value={value} />
      {categories.map((c) => {
        const selected = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(selected ? '' : c.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${selected
              ? 'border-primary bg-primary text-primary-foreground shadow-xs'
              : 'bg-background hover:bg-accent'}`}
          >
            <AppIcon icon={c.icon} className={`size-4 shrink-0 ${selected ? '' : 'text-muted-foreground'}`} />
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
