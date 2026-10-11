'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';

export function ConfirmButton({
  label,
  description,
  onConfirm,
  confirmLabel = 'Confirm',
  variant = 'destructive',
  redirectTo,
  confirmText,
}: {
  label: string;
  description: string;
  onConfirm: () => Promise<void>;
  confirmLabel?: string;
  variant?: 'destructive' | 'outline';
  redirectTo?: string;
  /** When set, the user must type this exact text before Confirm is enabled. */
  confirmText?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const confirmed = confirmText === undefined || typed === confirmText;

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
      setTyped('');
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setError(null); setTyped(''); } }}>
      <DialogTrigger render={<Button type="button" variant={variant} size="sm" />}>{label}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Are you sure?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        {confirmText !== undefined && (
          <div className="space-y-2">
            <Label htmlFor="confirm-text" className="block text-sm font-normal">
              Type <span className="font-semibold">{confirmText}</span> to confirm
            </Label>
            <Input
              id="confirm-text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && confirmed && !pending) void handleConfirm(); }}
            />
          </div>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button type="button" variant={variant === 'destructive' ? 'destructive' : 'default'} disabled={pending || !confirmed} onClick={handleConfirm}>
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
