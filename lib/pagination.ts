export function totalPages(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** A requested page (e.g. from the URL) as a number between 1 and `pages`. */
export function clampPage(requested: string | number | undefined, pages: number) {
  const n = Math.floor(Number(requested));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, pages);
}

/** Page links to show: first, last, and the current page's neighbours, with 'gap' between. */
export function pageNumbers(current: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const wanted = new Set([1, pages, current - 1, current, current + 1]);
  if (current <= 2) wanted.add(3);
  if (current >= pages - 1) wanted.add(pages - 2);
  const sorted = [...wanted].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    if (i > 0 && p - prev === 2) out.push(prev + 1); // never hide a single page behind "…"
    else if (i > 0 && p - prev > 2) out.push('gap');
    out.push(p);
  });
  return out;
}
