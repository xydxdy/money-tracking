import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { pageNumbers } from '@/lib/pagination';

/** ‹ 1 … 4 5 6 … 20 › page links. `hrefFor` builds the URL for a page (keeping other params). */
export function Pagination({ page, pageCount, hrefFor, summary }: {
  page: number; pageCount: number; hrefFor: (page: number) => string; summary?: string;
}) {
  if (pageCount <= 1) return summary ? <p className="text-sm text-muted-foreground">{summary}</p> : null;
  const item = 'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm transition-colors';
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3">
      {summary ? <p className="text-sm text-muted-foreground">{summary}</p> : <span />}
      <div className="flex items-center gap-1">
        {page > 1
          ? <Link href={hrefFor(page - 1)} aria-label="Previous page" className={`${item} hover:bg-accent`}><ChevronLeftIcon className="size-4" /></Link>
          : <span className={`${item} text-muted-foreground/40`} aria-hidden><ChevronLeftIcon className="size-4" /></span>}
        {pageNumbers(page, pageCount).map((p, i) =>
          p === 'gap'
            ? <span key={`gap-${i}`} className={`${item} text-muted-foreground`}>…</span>
            : <Link key={p} href={hrefFor(p)} aria-current={p === page ? 'page' : undefined}
                className={`${item} ${p === page ? 'bg-primary font-medium text-primary-foreground' : 'hover:bg-accent'}`}>{p}</Link>
        )}
        {page < pageCount
          ? <Link href={hrefFor(page + 1)} aria-label="Next page" className={`${item} hover:bg-accent`}><ChevronRightIcon className="size-4" /></Link>
          : <span className={`${item} text-muted-foreground/40`} aria-hidden><ChevronRightIcon className="size-4" /></span>}
      </div>
    </nav>
  );
}
