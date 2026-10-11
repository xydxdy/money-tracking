'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COMMON_CURRENCIES } from '@/lib/currencies';

const OTHER = '__other__';
const KNOWN = new Set<string>(COMMON_CURRENCIES.map((c) => c.code));

/**
 * Currency picker: common currencies with their symbols, plus "Other…" to type any 3-letter code.
 * The chosen code is submitted under `name`.
 */
export function CurrencySelect({ id, name, defaultValue = 'USD', className }: { id?: string; name: string; defaultValue?: string; className?: string }) {
  const [code, setCode] = useState(defaultValue.toUpperCase());
  const [other, setOther] = useState(!KNOWN.has(defaultValue.toUpperCase()));
  const items: Record<string, string> = {
    ...Object.fromEntries(COMMON_CURRENCIES.map((c) => [c.code, `${c.symbol} ${c.code}`])),
    [OTHER]: 'Other…',
  };

  return (
    <div className={`flex gap-2 ${className ?? ''}`}>
      <input type="hidden" name={name} value={code} />
      <Select
        value={other ? OTHER : code}
        items={items}
        onValueChange={(v) => {
          if (v === OTHER) { setOther(true); setCode(''); }
          else if (v) { setOther(false); setCode(v); }
        }}
      >
        <SelectTrigger id={id} className="min-w-28 flex-1" aria-label="Currency"><SelectValue /></SelectTrigger>
        <SelectContent>
          {COMMON_CURRENCIES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              <span className="inline-block w-9 font-medium">{c.symbol}</span>{c.code} <span className="text-muted-foreground">· {c.name}</span>
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={OTHER}>Other…</SelectItem>
        </SelectContent>
      </Select>
      {other && (
        <Input
          aria-label="Currency code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))}
          placeholder="e.g. CHF"
          className="w-24 uppercase"
          required
          minLength={3}
          maxLength={3}
        />
      )}
    </div>
  );
}
