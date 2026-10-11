import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Prev / current / next month pager. `hrefFor` builds the link for a `YYYY-MM` month. */
export function MonthNav({ label, prevHref, nextHref, todayHref, extra }: {
  label: string; prevHref: string; nextHref: string; todayHref?: string; extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded-lg border bg-card">
        <Button render={<Link href={prevHref} aria-label="Previous month" />} nativeButton={false} variant="ghost" size="icon"><ChevronLeftIcon /></Button>
        <span className="min-w-32 px-2 text-center text-sm font-medium">{label}</span>
        <Button render={<Link href={nextHref} aria-label="Next month" />} nativeButton={false} variant="ghost" size="icon"><ChevronRightIcon /></Button>
      </div>
      {todayHref && <Button render={<Link href={todayHref} />} nativeButton={false} variant="outline" size="sm">This month</Button>}
      {extra}
    </div>
  );
}
