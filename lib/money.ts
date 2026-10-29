import { currencySymbol } from '@/lib/currencies';

export function toCents(numeric: string): number {
  const negative = numeric.trim().startsWith('-');
  const [wholeRaw, fracRaw = ''] = numeric.trim().replace('-', '').split('.');
  const whole = wholeRaw === '' ? 0 : parseInt(wholeRaw, 10);
  const frac = (fracRaw + '00').slice(0, 2);
  const cents = whole * 100 + parseInt(frac, 10);
  return negative ? -cents : cents;
}

export function fromCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

export function addCents(...values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0);
}

/**
 * `฿1,000.00`, `-$5.00`, `¥1,000`. Uses the symbol from lib/currencies.ts (falling back to the
 * code), and the currency's usual number of decimals (none for JPY/KRW).
 */
export function formatMoney(cents: number, currency: string): string {
  let parts: Intl.NumberFormatPart[];
  try {
    parts = new Intl.NumberFormat('en-US', { style: 'currency', currency }).formatToParts(cents / 100);
  } catch {
    // Not a currency code Intl knows: show "XYZ 5.00".
    return `${currency} ${fromCents(cents)}`;
  }
  const symbol = currencySymbol(currency);
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.type === 'currency') {
      out += symbol;
      // Intl puts a space after a bare code ("THB 1.00"); a symbol sits directly against the number.
      if (symbol !== currency && parts[i + 1]?.type === 'literal' && /^\s+$/.test(parts[i + 1].value)) i++;
    } else {
      out += part.value;
    }
  }
  return out;
}

/**
 * Cleans what's typed into an amount field: digits and one decimal point with at most two digits
 * after it. Everything else is dropped, including thousands separators ("1,200" → "1200").
 */
export function sanitizeAmount(raw: string): string {
  const [whole, ...rest] = raw.replace(/[^\d.]/g, '').split('.');
  return rest.length === 0 ? whole : `${whole}.${rest.join('').slice(0, 2)}`;
}
