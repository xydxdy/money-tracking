'use client';
import { useState, type ReactNode } from 'react';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

/** A button that opens a form in a dialog; the form calls `close` once it has saved. */
export function EditDialog({ title, children, triggerLabel = 'Edit', create = false }: {
  title: string; children: (close: () => void) => ReactNode; triggerLabel?: string; create?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant={create ? 'default' : 'outline'} size={create ? 'default' : 'sm'} />}>
        {create && <PlusIcon />}{triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  );
}
