'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';

export function ConfirmButton({
  label,
  description,
  onConfirm,
  confirmLabel = 'Confirm',
  variant = 'destructive',
  redirectTo,
}: {
  label: string;
  description: string;
  onConfirm: () => Promise<void>;
  confirmLabel?: string;
  variant?: 'destructive' | 'outline';
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null); }}>
      <DialogTrigger render={<Button type="button" variant={variant} size="sm" />}>{label}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Are you sure?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button type="button" variant={variant === 'destructive' ? 'destructive' : 'default'} disabled={pending} onClick={handleConfirm}>
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
