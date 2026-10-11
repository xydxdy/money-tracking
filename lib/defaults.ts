import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { accountTypes, categories } from '@/db/schema';

type TypePreset = { key: string; name: string; icon: string };

/** Starter account types given to new users. */
export const DEFAULT_ACCOUNT_TYPES: TypePreset[] = [
  { key: 'bank', name: 'Bank', icon: 'landmark' },
  { key: 'credit', name: 'Credit card', icon: 'credit-card' },
  { key: 'cash', name: 'Cash', icon: 'banknote' },
  { key: 'wallet', name: 'E-wallet', icon: 'wallet' },
  { key: 'travel', name: 'Travel card', icon: 'plane' },
];

/** Bank and Cash always exist for every user and can't be edited or deleted. */
export const PROTECTED_ACCOUNT_TYPES = DEFAULT_ACCOUNT_TYPES.filter((t) => t.key === 'bank' || t.key === 'cash');

export function isProtectedAccountType(name: string) {
  return PROTECTED_ACCOUNT_TYPES.some((t) => t.name.toLowerCase() === name.trim().toLowerCase());
}

/**
 * Built-in type keys used by version 1/2 backup files ("bank", "credit", …) and the type each
 * lands on when imported. "grant" is no longer a default but still gets its own type on import,
 * so those accounts aren't left untyped.
 */
export const LEGACY_ACCOUNT_TYPES: TypePreset[] = [
  ...DEFAULT_ACCOUNT_TYPES,
  { key: 'grant', name: 'Grant', icon: 'graduation-cap' },
];

export const DEFAULT_CATEGORIES: { name: string; type: 'expense' | 'income' | 'transfer'; icon: string }[] = [
  { type: 'expense', name: 'Grocery', icon: 'shopping-cart' },
  { type: 'expense', name: 'Food / Cafe', icon: 'coffee' },
  { type: 'expense', name: 'House Renting', icon: 'house' },
  { type: 'expense', name: 'Electricity & Internet', icon: 'lightbulb' },
  { type: 'expense', name: 'Transportation', icon: 'train' },
  { type: 'expense', name: 'Travel', icon: 'plane' },
  { type: 'expense', name: 'Shopping', icon: 'shopping-bag' },
  { type: 'expense', name: 'Health', icon: 'pill' },
  { type: 'expense', name: 'Entertainment', icon: 'film' },
  { type: 'expense', name: 'Education', icon: 'graduation-cap' },
  { type: 'expense', name: 'Others', icon: 'package' },
  { type: 'income', name: 'Salary', icon: 'briefcase' },
  { type: 'income', name: 'Personal Savings', icon: 'piggy-bank' },
  { type: 'income', name: 'Refund', icon: 'undo' },
  { type: 'income', name: 'Gift', icon: 'gift' },
  { type: 'income', name: 'Other Income', icon: 'plus' },
  { type: 'transfer', name: 'Bank Transfer', icon: 'repeat' },
  { type: 'transfer', name: 'Cash Withdrawal', icon: 'banknote' },
  { type: 'transfer', name: 'Wallet Top-up', icon: 'smartphone' },
  { type: 'transfer', name: 'Currency Exchange', icon: 'exchange' },
  { type: 'transfer', name: 'Move to Saving', icon: 'landmark' },
];

type Executor = Pick<typeof db, 'select' | 'insert'>;

/**
 * Gives a user the starter account types and categories. Each list is only seeded when the user
 * has none yet, so calling this again (or for a user who already set things up) changes nothing.
 */
export async function seedUserDefaults(userId: string, executor: Executor = db) {
  const [existingType] = await executor.select({ id: accountTypes.id }).from(accountTypes).where(eq(accountTypes.userId, userId)).limit(1);
  if (!existingType) {
    await executor.insert(accountTypes).values(DEFAULT_ACCOUNT_TYPES.map(({ name, icon }) => ({ userId, name, icon })));
  }
  const [existingCategory] = await executor.select({ id: categories.id }).from(categories).where(eq(categories.userId, userId)).limit(1);
  if (!existingCategory) {
    await executor.insert(categories).values(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })));
  }
}
