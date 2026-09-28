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

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}
