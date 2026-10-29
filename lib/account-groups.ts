import { addCents } from '@/lib/money';

export type CurrencyTotal = { currency: string; cents: number };

/** Sums balances per currency (a group can mix currencies), in the order currencies first appear. */
export function totalsByCurrency(rows: { currency: string; balanceCents: number }[]): CurrencyTotal[] {
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.currency, addCents(totals.get(r.currency) ?? 0, r.balanceCents));
  return [...totals].map(([currency, cents]) => ({ currency, cents }));
}

/** Case-insensitive match of a search query against any of the given fields. */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]) {
  const q = query.trim().toLowerCase();
  return q === '' || fields.some((f) => f?.toLowerCase().includes(q));
}

/**
 * Orders accounts for pickers: by their group's display order (ungrouped accounts last), then
 * favourites first within each group. Otherwise keeps the incoming (user's) order.
 */
export function sortByGroup<A extends { groupId: string | null; favorite: boolean }>(accounts: A[], groups: { id: string }[]): A[] {
  const rank = new Map(groups.map((g, i) => [g.id, i]));
  const groupRank = (a: A) => (a.groupId !== null && rank.has(a.groupId) ? rank.get(a.groupId)! : groups.length);
  return [...accounts].sort((a, b) => groupRank(a) - groupRank(b) || Number(b.favorite) - Number(a.favorite));
}
