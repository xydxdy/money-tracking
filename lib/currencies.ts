// Common currencies offered in currency pickers, with the symbol shown next to amounts.
// Symbols that would otherwise look identical are kept distinguishable (CN¥ vs ¥, A$/S$ vs $),
// since one person's accounts can mix currencies.
export const COMMON_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US dollar' },
  { code: 'THB', symbol: '฿', name: 'Thai baht' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese yen' },
  { code: 'KRW', symbol: '₩', name: 'South Korean won' },
  { code: 'CNY', symbol: 'CN¥', name: 'Chinese yuan' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong dollar' },
  { code: 'TWD', symbol: 'NT$', name: 'New Taiwan dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore dollar' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian ringgit' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian rupiah' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese dong' },
  { code: 'PHP', symbol: '₱', name: 'Philippine peso' },
  { code: 'INR', symbol: '₹', name: 'Indian rupee' },
  { code: 'LAK', symbol: '₭', name: 'Lao kip' },
  { code: 'KHR', symbol: '៛', name: 'Cambodian riel' },
  { code: 'MMK', symbol: 'K', name: 'Myanmar kyat' },
  { code: 'AUD', symbol: 'A$', name: 'Australian dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand dollar' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss franc' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish krona' },
  { code: 'AED', symbol: 'AED', name: 'UAE dirham' },
] as const;

const SYMBOLS: Record<string, string> = Object.fromEntries(COMMON_CURRENCIES.map((c) => [c.code, c.symbol]));

/** The symbol for a currency code, or the code itself when it isn't in the list. */
export function currencySymbol(code: string): string {
  return SYMBOLS[code] ?? code;
}
