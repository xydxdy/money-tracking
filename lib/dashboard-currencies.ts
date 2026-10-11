/**
 * Currencies the dashboard can show, in the order offered: the user's active accounts in their own
 * account order (currency/name, or their drag order), then archived accounts' currencies, then any
 * other currency that has activity (alphabetically).
 */
export function dashboardCurrencyOptions(
  accountsInOrder: { currency: string; archived: boolean }[],
  activityCurrencies: string[],
): string[] {
  const active = accountsInOrder.filter((a) => !a.archived).map((a) => a.currency);
  const archived = accountsInOrder.filter((a) => a.archived).map((a) => a.currency);
  return [...new Set([...active, ...archived, ...[...activityCurrencies].sort()])];
}

/** The dashboard shows one currency: the requested one if it's an option, else the first option. */
export function pickDashboardCurrency(options: string[], requested: string | undefined): string | undefined {
  const wanted = requested?.toUpperCase();
  return options.find((c) => c === wanted) ?? options[0];
}
