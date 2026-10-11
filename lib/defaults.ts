import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { accountTypes, categories } from '@/db/schema';
import type { AccountColor } from '@/lib/account-appearance';

type TypePreset = { key: string; name: string; icon: string; color: AccountColor };

/** Starter account types given to new users. */
export const DEFAULT_ACCOUNT_TYPES: TypePreset[] = [
  { key: 'bank', name: 'Bank', icon: '🏦', color: 'blue' },
  { key: 'credit', name: 'Credit card', icon: '💳', color: 'violet' },
  { key: 'cash', name: 'Cash', icon: '💵', color: 'emerald' },
  { key: 'wallet', name: 'E-wallet', icon: '👛', color: 'amber' },
  { key: 'travel', name: 'Travel card', icon: '✈️', color: 'sky' },
];

/**
 * Built-in type keys used by version 1/2 backup files ("bank", "credit", …) and the type each
 * lands on when imported. "grant" is no longer a default but still gets its own type on import,
 * so those accounts aren't left untyped.
 */
export const LEGACY_ACCOUNT_TYPES: TypePreset[] = [
  ...DEFAULT_ACCOUNT_TYPES,
  { key: 'grant', name: 'Grant', icon: '🎓', color: 'teal' },
];

export const DEFAULT_CATEGORIES: { name: string; type: 'expense' | 'income' | 'transfer'; icon: string }[] = [
  { type: 'expense', name: 'Grocery', icon: '🛒' },
  { type: 'expense', name: 'Food / Cafe', icon: '☕' },
  { type: 'expense', name: 'House Renting', icon: '🏠' },
  { type: 'expense', name: 'Electricity & Internet', icon: '💡' },
  { type: 'expense', name: 'Transportation', icon: '🚆' },
  { type: 'expense', name: 'Travel', icon: '✈️' },
  { type: 'expense', name: 'Shopping', icon: '🛍️' },
  { type: 'expense', name: 'Health', icon: '💊' },
  { type: 'expense', name: 'Entertainment', icon: '🎬' },
  { type: 'expense', name: 'Education', icon: '🎓' },
  { type: 'expense', name: 'Others', icon: '📦' },
  { type: 'income', name: 'Salary', icon: '💼' },
  { type: 'income', name: 'Personal Savings', icon: '🐷' },
  { type: 'income', name: 'Refund', icon: '↩️' },
  { type: 'income', name: 'Gift', icon: '🎁' },
  { type: 'income', name: 'Other Income', icon: '➕' },
  { type: 'transfer', name: 'Bank Transfer', icon: '🔁' },
  { type: 'transfer', name: 'Cash Withdrawal', icon: '🏧' },
  { type: 'transfer', name: 'Wallet Top-up', icon: '📲' },
  { type: 'transfer', name: 'Currency Exchange', icon: '💱' },
  { type: 'transfer', name: 'Move to Saving', icon: '🏦' },
];

type Executor = Pick<typeof db, 'select' | 'insert'>;

/**
 * Gives a user the starter account types and categories. Each list is only seeded when the user
 * has none yet, so calling this again (or for a user who already set things up) changes nothing.
 */
export async function seedUserDefaults(userId: string, executor: Executor = db) {
  const [existingType] = await executor.select({ id: accountTypes.id }).from(accountTypes).where(eq(accountTypes.userId, userId)).limit(1);
  if (!existingType) {
    await executor.insert(accountTypes).values(DEFAULT_ACCOUNT_TYPES.map(({ name, icon, color }) => ({ userId, name, icon, color })));
  }
  const [existingCategory] = await executor.select({ id: categories.id }).from(categories).where(eq(categories.userId, userId)).limit(1);
  if (!existingCategory) {
    await executor.insert(categories).values(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })));
  }
}
