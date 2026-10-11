'use client';
import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SearchIcon, XIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/date-picker';

export type FilterSelect = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
};

/**
 * Search box, filter dropdowns, a date range and a sort picker that all live in the URL query
 * string, so the server page does the filtering and any filtered view can be bookmarked.
 * `values` is the current (already parsed) query, passed down from the server page.
 */
export function ListToolbar({ values, selects, sorts, dateRange = true }: {
  values: Record<string, string | undefined>;
  selects: FilterSelect[];
  sorts: Record<string, string>;
  dateRange?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(values.q ?? '');

  function apply(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...values, ...changes })) {
      if (v) next.set(k, v);
    }
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Search as you type, after a short pause.
  useEffect(() => {
    if (query === (values.q ?? '')) return;
    const timer = setTimeout(() => apply({ q: query || undefined }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the typed query changes
  }, [query]);

  const active = Object.entries(values).some(([k, v]) => k !== 'sort' && v);
  const sortItems = Object.fromEntries(Object.entries(sorts));

  return (
    <div className={`space-y-3 rounded-xl border bg-card p-3 shadow-xs transition-opacity ${pending ? 'opacity-70' : ''}`}>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search details, notes and people…"
          aria-label="Search"
          className="pl-8"
        />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        {selects.map((s) => {
          const items = { '': `All ${s.label.toLowerCase()}`, ...Object.fromEntries(s.options.map((o) => [o.value, o.label])) };
          return (
            <Select key={s.key} value={values[s.key] ?? ''} items={items} onValueChange={(v) => apply({ [s.key]: v || undefined })}>
              <SelectTrigger className="w-44" aria-label={s.label}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All {s.label.toLowerCase()}</SelectItem>
                {s.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          );
        })}
        {dateRange && (
          <div role="group" aria-label="Date range" className="flex flex-wrap items-center gap-1.5">
            <DatePicker compact label="From" key={`from-${values.from ?? ''}`} name="from" defaultValue={values.from}
              onChange={(iso) => apply({ from: iso || undefined })} />
            <span className="text-muted-foreground" aria-hidden>–</span>
            <DatePicker compact label="To" key={`to-${values.to ?? ''}`} name="to" defaultValue={values.to}
              onChange={(iso) => apply({ to: iso || undefined })} />
          </div>
        )}
        <Select value={values.sort ?? Object.keys(sorts)[0]} items={sortItems} onValueChange={(v) => apply({ sort: v ?? undefined })}>
          <SelectTrigger className="w-48" aria-label="Sort"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(sorts).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        {active && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { setQuery(''); startTransition(() => router.replace(values.sort ? `${pathname}?sort=${values.sort}` : pathname, { scroll: false })); }}
          >
            <XIcon /> Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
