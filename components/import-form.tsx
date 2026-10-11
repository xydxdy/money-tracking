'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadIcon } from 'lucide-react';
import { previewImportAction, commitImportAction } from '@/app/actions/import';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Preview = Awaited<ReturnType<typeof previewImportAction>>;
type Existing = { accounts: number; categories: number; transactions: number; budgets: number };

export function ImportForm({ existing }: { existing: Existing }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [json, setJson] = useState<unknown>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasExistingData = existing.accounts + existing.categories + existing.transactions + existing.budgets > 0;

  async function loadFile(file: File | undefined) {
    setPreview(null);
    setJson(null);
    setError(null);
    setSuccess(null);
    setFileName(file?.name ?? null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      setError('Please choose a .json backup file.');
      return;
    }
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

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    void loadFile(e.dataTransfer.files?.[0]);
  }

  async function onConfirm() {
    if (!json) return;
    setPending(true);
    setError(null);
    try {
      const res = await commitImportAction(json);
      if (!res.ok) {
        setError(`${res.error} Your existing data was not changed.`);
        return;
      }
      const { accounts, categories, transactions, budgets } = res.result.imported;
      setSuccess(`Replaced your data with ${accounts} accounts, ${categories} categories, ${transactions} transactions and ${budgets} budgets.`);
      setPreview(null);
      setJson(null);
      setFileName(null);
      if (inputRef.current) inputRef.current.value = '';
      router.refresh();
    } catch {
      setError('Import failed. Your existing data was not changed.');
    } finally {
      setPending(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload backup file"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${dragging ? 'border-primary bg-accent' : 'border-muted-foreground/30 hover:bg-accent/40'}`}
      >
        <UploadIcon className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium">{fileName ?? 'Drag and drop your backup .json file here'}</p>
        <p className="text-xs text-muted-foreground">or click to choose a file</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => void loadFile(e.target.files?.[0])}
        />
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {success && <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>}

      {preview && (
        <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
          <p>File contains — Accounts: {preview.counts.accounts} · Categories: {preview.counts.categories} · Transactions: {preview.counts.transactions} · Budgets: {preview.counts.budgets}</p>
          {preview.warnings.map((w, i) => <p key={i} className="text-amber-600 dark:text-amber-400">⚠ {w}</p>)}
          {preview.errors.map((e, i) => <p key={i} className="text-destructive">✕ {e}</p>)}
          {preview.errors.length === 0 && (
            <>
              {hasExistingData && (
                <p className="font-medium text-destructive">
                  Importing replaces all of your current data ({existing.accounts} accounts, {existing.categories} categories, {existing.transactions} transactions, {existing.budgets} budgets). It is not merged.
                </p>
              )}
              <Button variant={hasExistingData ? 'destructive' : 'default'} onClick={() => setConfirmOpen(true)} disabled={pending}>
                {hasExistingData ? 'Replace all data' : 'Import'}
              </Button>
            </>
          )}
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={(open) => { if (!pending) setConfirmOpen(open); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{hasExistingData ? 'Replace all data?' : 'Import this backup?'}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {hasExistingData
              ? 'All of your current accounts, categories, transactions and budgets will be permanently deleted and replaced with the contents of this file. Download an export first if you may need them.'
              : 'The accounts, categories, transactions and budgets in this file will be added to your account.'}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="button" variant={hasExistingData ? 'destructive' : 'default'} onClick={onConfirm} disabled={pending}>
              {pending ? 'Importing…' : hasExistingData ? 'Replace all data' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
