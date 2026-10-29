import { describe, it, expect } from 'vitest';
import { matchesQuery, sortByGroup, totalsByCurrency } from '@/lib/account-groups';

describe('totalsByCurrency', () => {
  it('sums per currency in first-seen order', () => {
    expect(totalsByCurrency([
      { currency: 'THB', balanceCents: 10_000 },
      { currency: 'USD', balanceCents: 500 },
      { currency: 'THB', balanceCents: -2_550 },
    ])).toEqual([{ currency: 'THB', cents: 7_450 }, { currency: 'USD', cents: 500 }]);
  });

  it('is empty for no accounts', () => {
    expect(totalsByCurrency([])).toEqual([]);
  });
});

describe('matchesQuery', () => {
  it('matches any field, ignoring case and surrounding spaces', () => {
    expect(matchesQuery(' usd ', 'Savings', 'Bank', 'USD')).toBe(true);
    expect(matchesQuery('kbank', 'Savings', null)).toBe(false);
    expect(matchesQuery('', 'anything')).toBe(true);
  });
});

describe('sortByGroup', () => {
  it('orders by group, ungrouped last, favourites first within a group', () => {
    const acc = (id: string, groupId: string | null, favorite = false) => ({ id, groupId, favorite });
    const sorted = sortByGroup(
      [acc('loose', null), acc('b1', 'b'), acc('a1', 'a'), acc('b2', 'b', true), acc('gone', 'deleted'), acc('a2', 'a')],
      [{ id: 'b' }, { id: 'a' }],
    );
    expect(sorted.map((a) => a.id)).toEqual(['b2', 'b1', 'a1', 'a2', 'loose', 'gone']);
  });
});
