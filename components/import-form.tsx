'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { previewImportAction, commitImportAction } from '@/app/actions/import';
import { Button } from '@/components/ui/button';

type Preview = Awaited<ReturnType<typeof previewImportAction>>;

export function ImportForm({ hasExistingData }: { hasExistingData: boolean }) {
  const router = useRouter();
  const [json, setJson] = useState<unknown>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPreview(null);
    setJson(null);
    setError(null);
    setSuccess(null);
    if (!file) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setError('That file is not valid JSON.');
      return;
    }
    try {
      setJson(parsed);
      setPreview(await previewImportAction(parsed));
    } catch {
      setError('Could not preview this file. Please try again.');
    }
  }

  async function onConfirm() {
    if (!json) return;
    setPending(true);
    setError(null);
    try {
      const res = await commitImportAction(json);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const { accounts, categories, transactions, budgets } = res.result.imported;
      setSuccess(`Imported ${accounts} accounts, ${categories} categories, ${transactions} transactions and ${budgets} budgets.`);
      setPreview(null);
      setJson(null);
      router.refresh();
    } catch {
      setError('Import failed. Nothing was saved.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <input type="file" accept="application/json,.json" onChange={onFileChange} aria-label="Backup file" />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {success && <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}
      {preview && (
        <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
          <p>Accounts: {preview.counts.accounts} · Categories: {preview.counts.categories} · Transactions: {preview.counts.transactions} · Budgets: {preview.counts.budgets}</p>
          {preview.warnings.map((w, i) => <p key={i} className="text-amber-600 dark:text-amber-400">⚠ {w}</p>)}
          {preview.errors.map((e, i) => <p key={i} className="text-destructive">✕ {e}</p>)}
          {preview.errors.length === 0 && hasExistingData && (
            <p className="text-amber-600 dark:text-amber-400">⚠ You already have data. Importing adds these records alongside it, so importing the same backup twice creates duplicates.</p>
          )}
          {preview.errors.length === 0 && (
            <Button onClick={onConfirm} disabled={pending}>{pending ? 'Importing…' : 'Confirm import'}</Button>
          )}
        </div>
      )}
    </div>
  );
}
