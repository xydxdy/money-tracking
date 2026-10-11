'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COMMON_CURRENCIES, currencySymbol } from '@/lib/currencies';

/** Picks the one currency the dashboard shows; the choice lives in the `currency` URL param. */
export function DashboardCurrencySwitcher({ options, value }: { options: string[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const label = (code: string) => {
    const name = COMMON_CURRENCIES.find((c) => c.code === code)?.name;
    return `${currencySymbol(code)} ${code}${name ? ` · ${name}` : ''}`;
  };
  const items = Object.fromEntries(options.map((c) => [c, `${currencySymbol(c)} ${c}`]));
  return (
    <Select
      value={value}
      items={items}
      onValueChange={(v) => {
        if (!v) return;
        const next = new URLSearchParams(params.toString());
        next.set('currency', v);
        router.push(`${pathname}?${next}`);
      }}
    >
      <SelectTrigger className="min-w-28" aria-label="Currency shown on the dashboard"><SelectValue /></SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {options.map((c) => <SelectItem key={c} value={c}>{label(c)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
