'use client';
import { useState } from 'react';
import { CalendarIcon, XIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDate, parseDisplayDate } from '@/lib/dates';

function isoFromLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function localDateFromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayIso(): string {
  return isoFromLocalDate(new Date());
}

/**
 * A DD/MM/YYYY date field. The visible text box accepts typed dates and the calendar button
 * picks one; the form receives the ISO `YYYY-MM-DD` value through a hidden input named `name`
 * (empty while the typed text isn't a valid date).
 */
export function DatePicker({ id, name, defaultValue, onChange, placeholder = 'DD/MM/YYYY', compact = false, label }: {
  id?: string; name: string; defaultValue?: string; onChange?: (iso: string) => void; placeholder?: string;
  /** Single-field style for filter bars: optional inline label, a clear button and a calendar icon. */
  compact?: boolean;
  label?: string;
}) {
  const [iso, setIso] = useState(defaultValue ?? '');
  const [text, setText] = useState(defaultValue ? formatDate(defaultValue) : '');
  const [open, setOpen] = useState(false);

  function onType(value: string) {
    setText(value);
    const parsed = parseDisplayDate(value) ?? '';
    setIso(parsed);
    // Report a cleared field or a complete valid date, not every half-typed keystroke.
    if (parsed || value === '') onChange?.(parsed);
  }

  function onPick(date: Date | undefined) {
    if (!date) return;
    const picked = isoFromLocalDate(date);
    setIso(picked);
    setText(formatDate(picked));
    setOpen(false);
    onChange?.(picked);
  }

  function clear() {
    setText('');
    setIso('');
    onChange?.('');
  }

  const calendar = (
    <PopoverContent className="w-auto p-0" align="end">
      <Calendar
        mode="single"
        weekStartsOn={1}
        selected={iso ? localDateFromIso(iso) : undefined}
        defaultMonth={iso ? localDateFromIso(iso) : undefined}
        onSelect={onPick}
      />
    </PopoverContent>
  );

  if (compact) {
    return (
      <div
        className={`flex h-8 items-center rounded-lg border bg-transparent text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30 ${text !== '' && !iso ? 'border-destructive' : 'border-input'}`}
      >
        {label && <span className="shrink-0 pl-2.5 text-xs text-muted-foreground">{label}</span>}
        <input
          id={id}
          value={text}
          onChange={(e) => onType(e.target.value)}
          placeholder={placeholder}
          inputMode="numeric"
          aria-label={label ? `${label} date` : 'Date'}
          aria-invalid={text !== '' && !iso}
          autoComplete="off"
          className="w-[7.5rem] min-w-0 bg-transparent px-2 text-base tabular-nums outline-none placeholder:text-muted-foreground md:text-sm"
        />
        <input type="hidden" name={name} value={iso} />
        {text && (
          <button type="button" onClick={clear} aria-label={`Clear ${label ?? 'date'}`} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
            <XIcon className="size-3.5" />
          </button>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<button type="button" aria-label="Open calendar" className="mr-1 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" />}>
            <CalendarIcon className="size-4" />
          </PopoverTrigger>
          {calendar}
        </Popover>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        value={text}
        onChange={(e) => onType(e.target.value)}
        placeholder={placeholder}
        inputMode="numeric"
        aria-invalid={text !== '' && !iso}
        autoComplete="off"
      />
      <input type="hidden" name={name} value={iso} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button type="button" variant="outline" size="icon" aria-label="Open calendar" />}>
          <CalendarIcon />
        </PopoverTrigger>
        {calendar}
      </Popover>
    </div>
  );
}
