'use client';
import { useState } from 'react';
import { CheckIcon } from 'lucide-react';
import { ACCOUNT_COLORS, type AccountColor } from '@/lib/account-appearance';

/** Row of colour swatches (radio group); the chosen palette key is submitted under `name`. */
export function ColorPicker({ name, defaultValue, onChange }: { name: string; defaultValue: AccountColor; onChange?: (c: AccountColor) => void }) {
  const [value, setValue] = useState<AccountColor>(defaultValue);
  return (
    <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2">
      <input type="hidden" name={name} value={value} />
      {(Object.keys(ACCOUNT_COLORS) as AccountColor[]).map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          aria-label={ACCOUNT_COLORS[key].label}
          title={ACCOUNT_COLORS[key].label}
          onClick={() => { setValue(key); onChange?.(key); }}
          className={`inline-flex size-7 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-background transition ${ACCOUNT_COLORS[key].swatch} ${value === key ? 'ring-2 ring-ring' : 'hover:scale-110'}`}
        >
          {value === key && <CheckIcon className="size-4" />}
        </button>
      ))}
    </div>
  );
}
