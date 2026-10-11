import { db } from '@/db/client';
import { accounts, categories, transactions, budgets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { backupSchema, type Backup } from './schema';
import { uuidv7 } from '@/lib/uuid';
import { toIconName } from '@/lib/icons';
import { FALLBACK_APPEARANCE } from '@/lib/account-appearance';
import { LEGACY_ACCOUNT_TYPES } from '@/lib/defaults';
import { accountTypes } from '@/db/schema';

export type PreviewResult = {
  counts: { accounts: number; categories: number; transactions: number; budgets: number };
  warnings: string[];
  errors: string[];
};

function findDanglingAccountRefs(backup: Backup): string[] {
  const accountIds = new Set(backup.accounts.map((a) => a.id));
  const dangling = new Set<string>();
  for (const t of backup.transactions) {
    if (t.fromAccountId && !accountIds.has(t.fromAccountId)) dangling.add(t.fromAccountId);
    if (t.toAccountId && !accountIds.has(t.toAccountId)) dangling.add(t.toAccountId);
  }
  return Array.from(dangling);
}

/** Loans, plus expenses paid by / income received by a person (no account on that side). */
function involvesPerson(t: Backup['transactions'][number]) {
  return t.type === 'loan'
    || (t.type === 'expense' && !t.fromAccountId && !!t.counterparty)
    || (t.type === 'income' && !t.toAccountId && !!t.counterparty);
}

function findIncompleteLoans(backup: Backup): string[] {
  const errors: string[] = [];
  for (const t of backup.transactions) {
    if (t.type === 'expense' && !t.fromAccountId && !t.counterparty) errors.push(`expense ${t.id} has no account or person who paid`);
    if (t.type === 'income' && !t.toAccountId && !t.counterparty) errors.push(`income ${t.id} has no account or person who received it`);
    if (t.type !== 'loan') continue;
    if (!t.counterparty) errors.push(`loan ${t.id} has no person (counterparty)`);
    if (!t.loanKind) errors.push(`loan ${t.id} has no loan kind`);
  }
  return errors;
}

function findTypeMismatches(backup: Backup): string[] {
  const categoryType = new Map(backup.categories.map((c) => [c.id, c.type]));
  const errors: string[] = [];
  for (const t of backup.transactions) {
    if (t.categoryId && categoryType.has(t.categoryId) && categoryType.get(t.categoryId) !== t.type) {
      errors.push(`transaction ${t.id} has type "${t.type}" but references category "${t.categoryId}" of type "${categoryType.get(t.categoryId)}"`);
    }
  }
  return errors;
}

function findMissingCategoryRefs(backup: Backup): string[] {
  const categoryIds = new Set(backup.categories.map((c) => c.id));
  const errors: string[] = [];
  for (const t of backup.transactions) {
    if (t.categoryId && !categoryIds.has(t.categoryId)) {
      errors.push(`transaction ${t.id} references missing category ${t.categoryId}`);
    }
  }
  for (const b of backup.budgets) {
    if (!categoryIds.has(b.categoryId)) {
      errors.push(`budget ${b.id} references missing category ${b.categoryId}`);
    }
  }
  return errors;
}

export function previewImport(json: unknown): PreviewResult {
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) {
    return {
      counts: { accounts: 0, categories: 0, transactions: 0, budgets: 0 },
      warnings: [],
      errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  const backup = parsed.data;

  const dupErrors = (name: string, rows: { id: string }[]) => {
    const seen = new Set<string>();
    const dups: string[] = [];
    for (const { id } of rows) {
      if (seen.has(id)) dups.push(id);
      seen.add(id);
    }
    return dups.map((id) => `duplicate ${name} id: ${id}`);
  };

  const warnings = findDanglingAccountRefs(backup).map((id) => `dangling-account: transaction references missing account ${id}; a recovered placeholder account will be created`);
  const errors = [
    ...dupErrors('account', backup.accounts),
    ...dupErrors('category', backup.categories),
    ...dupErrors('transaction', backup.transactions),
    ...dupErrors('budget', backup.budgets),
    ...findMissingCategoryRefs(backup),
    ...findTypeMismatches(backup),
    ...findIncompleteLoans(backup),
  ];

  return {
    counts: {
      accounts: backup.accounts.length,
      categories: backup.categories.length,
      transactions: backup.transactions.length,
      budgets: backup.budgets.length,
    },
    warnings,
    errors,
  };
}

export type CommitResult = {
  imported: { accounts: number; categories: number; transactions: number; budgets: number };
};

export async function commitImport(json: unknown, userId: string): Promise<CommitResult> {
  const preview = previewImport(json);
  if (preview.errors.length > 0) {
    throw new Error(`Import aborted: ${preview.errors.join('; ')}`);
  }
  const backup = backupSchema.parse(json);

  // Backup ids are only meaningful inside the backup file. Primary keys are global across users
  // (and some backup ids are human-readable, e.g. "c_food"), so every row gets a fresh id and all
  // references are rewritten through these maps. This lets any user import a backup without
  // colliding with rows another user already owns.
  const accountIdMap = new Map<string, string>();
  const categoryIdMap = new Map<string, string>();
  const newId = () => uuidv7();
  for (const a of backup.accounts) accountIdMap.set(a.id, newId());
  for (const c of backup.categories) categoryIdMap.set(c.id, newId());
  const danglingIds = findDanglingAccountRefs(backup);
  for (const id of danglingIds) accountIdMap.set(id, newId());

  const mapAccount = (id: string | null) => (id ? accountIdMap.get(id)! : null);
  const mapCategory = (id: string | null) => (id ? categoryIdMap.get(id)! : null);

  return db.transaction(async (tx) => {
    // An import replaces the user's data rather than adding to it. Deleting inside the same
    // transaction as the inserts means a failed import leaves the old data untouched.
    // Order matters: transactions reference accounts (ON DELETE RESTRICT) and categories.
    await tx.delete(transactions).where(eq(transactions.userId, userId));
    await tx.delete(budgets).where(eq(budgets.userId, userId));
    await tx.delete(categories).where(eq(categories.userId, userId));
    await tx.delete(accounts).where(eq(accounts.userId, userId));

    // Account types are the user's own list and are kept across imports. Each type in the file
    // is matched to an existing type by name (ignoring case) — built-in keys like "credit" are
    // first translated to their default names — and created when there is no match.
    const existingTypes = await tx.select().from(accountTypes).where(eq(accountTypes.userId, userId));
    const typeByName = new Map(existingTypes.map((t) => [t.name.toLowerCase(), t]));
    const resolveType = async (raw: string) => {
      const builtIn = LEGACY_ACCOUNT_TYPES.find((d) => d.key === raw.toLowerCase());
      const name = builtIn?.name ?? raw;
      let type = typeByName.get(name.toLowerCase());
      if (!type) {
        [type] = await tx.insert(accountTypes).values({
          userId, name, icon: builtIn?.icon ?? FALLBACK_APPEARANCE.icon,
        }).returning();
        typeByName.set(name.toLowerCase(), type);
      }
      return type;
    };

    if (backup.accounts.length > 0) {
      const rows = [];
      for (const a of backup.accounts) {
        const type = a.type ? await resolveType(a.type) : null;
        rows.push({
          id: accountIdMap.get(a.id)!, userId, name: a.name, accountTypeId: type?.id ?? null, currency: a.currency,
          startingBalance: a.startingBalance.toFixed(2), note: a.note, archived: a.archived,
          color: a.color ?? FALLBACK_APPEARANCE.color,
          icon: toIconName(a.icon) ?? toIconName(type?.icon) ?? FALLBACK_APPEARANCE.icon,
        });
      }
      await tx.insert(accounts).values(rows);
    }

    for (const missingId of danglingIds) {
      const referencing = backup.transactions.find((t) => t.fromAccountId === missingId || t.toAccountId === missingId)!;
      await tx.insert(accounts).values({
        id: accountIdMap.get(missingId)!, userId, name: `Recovered Account (${missingId.slice(0, 8)})`,
        currency: referencing.currency, startingBalance: '0', archived: true, color: 'slate', icon: 'help',
      });
    }

    if (backup.categories.length > 0) {
      await tx.insert(categories).values(backup.categories.map((c) => ({
        id: categoryIdMap.get(c.id)!, userId, name: c.name, type: c.type, icon: toIconName(c.icon),
      })));
    }

    if (backup.transactions.length > 0) {
      // Ids are time-ordered, so give each imported transaction an id from its original creation
      // time, oldest first — the import keeps the order the transactions were originally added in.
      const byCreation = [...backup.transactions].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
      await tx.insert(transactions).values(byCreation.map((t) => ({
        id: uuidv7(Date.parse(t.createdAt) || Date.now()), userId, details: t.details, type: t.type, categoryId: mapCategory(t.categoryId),
        payDate: t.payDate, fromAccountId: mapAccount(t.fromAccountId), toAccountId: mapAccount(t.toAccountId),
        amount: t.amount.toFixed(2), toAmount: t.toAmount?.toFixed(2), currency: t.currency,
        status: t.status, reimbursable: t.reimbursable,
        reimbursementStatus: t.reimbursementStatus, receipt: t.receipt, link: t.link, note: t.note,
        loanKind: t.type === 'loan' ? t.loanKind : null,
        counterparty: involvesPerson(t) ? t.counterparty : null,
        loanClosedAt: involvesPerson(t) && t.loanClosedAt ? new Date(t.loanClosedAt) : null,
        createdAt: new Date(t.createdAt), updatedAt: new Date(t.updatedAt),
      })));
    }

    if (backup.budgets.length > 0) {
      await tx.insert(budgets).values(backup.budgets.map((b) => ({
        id: newId(), userId, month: b.month, categoryId: categoryIdMap.get(b.categoryId)!, currency: b.currency,
        plannedAmount: b.plannedAmount.toFixed(2),
      })));
    }

    return {
      imported: {
        accounts: backup.accounts.length + danglingIds.length,
        categories: backup.categories.length,
        transactions: backup.transactions.length,
        budgets: backup.budgets.length,
      },
    };
  });
}
