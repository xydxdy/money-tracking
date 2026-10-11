'use client';
import { useState } from 'react';
import { ChevronDownIcon, ShuffleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CATEGORY_ICON_GROUPS } from '@/lib/category-icons';

/** Emoji field: pick one from the dropdown grid or shuffle for a random one. Submitted under `name`. */
type IconGroup = { label: string; icons: readonly string[] };

export function IconPicker({ id, name, defaultValue, groups = CATEGORY_ICON_GROUPS, onChange }: {
  id?: string; name: string; defaultValue: string; groups?: readonly IconGroup[]; onChange?: (icon: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const all = groups.flatMap((g) => g.icons);
  function choose(icon: string) {
    setValue(icon);
    onChange?.(icon);
  }
  function shuffle() {
    const pool = all.filter((i) => i !== value);
    choose(pool[Math.floor(Math.random() * pool.length)] ?? value);
  }

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button id={id} type="button" variant="outline" className="w-16 justify-between px-2" aria-label="Choose icon" />}>
          <span className="text-lg leading-none">{value || '·'}</span>
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="max-h-80 w-72 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.label} className="space-y-1">
              {groups.length > 1 && <p className="text-xs text-muted-foreground">{group.label}</p>}
              <div className="grid grid-cols-6 gap-1">
                {group.icons.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    aria-label={`Use ${icon}`}
                    aria-pressed={icon === value}
                    onClick={() => { choose(icon); setOpen(false); }}
                    className={`rounded-md p-1.5 text-xl leading-none hover:bg-accent ${icon === value ? 'bg-accent ring-1 ring-ring' : ''}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </PopoverContent>
      </Popover>
      <input type="hidden" name={name} value={value} />
      <Button type="button" variant="outline" size="icon" aria-label="Random icon" title="Random icon" onClick={shuffle}>
        <ShuffleIcon />
      </Button>
    </div>
  );
}
