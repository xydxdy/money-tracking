import { describe, it, expect } from 'vitest';
import { pageNumbers, clampPage, totalPages } from '@/lib/pagination';

describe('pagination helpers', () => {
  it('counts pages (at least one)', () => {
    expect(totalPages(0, 50)).toBe(1);
    expect(totalPages(50, 50)).toBe(1);
    expect(totalPages(51, 50)).toBe(2);
  });

  it('clamps a requested page into range, defaulting to 1', () => {
    expect(clampPage(undefined, 5)).toBe(1);
    expect(clampPage('3', 5)).toBe(3);
    expect(clampPage('99', 5)).toBe(5);
    expect(clampPage('-2', 5)).toBe(1);
    expect(clampPage('abc', 5)).toBe(1);
  });

  it('lists all pages when there are few', () => {
    expect(pageNumbers(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('shows the first, last and neighbours of the current page, with gaps', () => {
    expect(pageNumbers(1, 20)).toEqual([1, 2, 3, 'gap', 20]);
    expect(pageNumbers(10, 20)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20]);
    expect(pageNumbers(20, 20)).toEqual([1, 'gap', 18, 19, 20]);
    expect(pageNumbers(4, 20)).toEqual([1, 2, 3, 4, 5, 'gap', 20]);
  });
});
