'use server';
import { revalidatePath } from 'next/cache';
import { previewImport, commitImport, type CommitResult } from '@/lib/import/importer';
import { getCurrentUser } from '@/lib/session';

export async function previewImportAction(json: unknown) {
  await getCurrentUser();
  return previewImport(json);
}

export async function commitImportAction(json: unknown): Promise<{ ok: true; result: CommitResult } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  try {
    const result = await commitImport(json, user.id);
    revalidatePath('/', 'layout');
    return { ok: true, result };
  } catch (err) {
    // Errors thrown from a Server Action lose their message in production builds, so return it instead.
    return { ok: false, error: err instanceof Error ? err.message : 'Import failed' };
  }
}
