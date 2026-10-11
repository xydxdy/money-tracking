'use client';
import { useState, type ReactNode } from 'react';
import { EllipsisIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/confirm-button';

/**
 * A row's "⋯" menu with Edit (opens `renderEdit` in a dialog) and Delete (asks for confirmation,
 * optionally requiring the item's name to be typed). Used for budgets, categories and account types.
 */
export function ActionsMenu({ label, editTitle, renderEdit, deleteDescription, confirmText, onDelete }: {
  /** e.g. "the Food budget" — used for the menu button's accessible name. */
  label: string;
  editTitle: string;
  renderEdit: (close: () => void) => ReactNode;
  deleteDescription: string;
  confirmText?: string;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${label}`}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-popup-open:bg-accent"
        >
          <EllipsisIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem onClick={() => setEditing(true)}><PencilIcon /> Edit</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}><Trash2Icon /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editTitle}</DialogTitle></DialogHeader>
          {editing && renderEdit(() => setEditing(false))}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        description={deleteDescription}
        confirmText={confirmText}
        confirmLabel="Delete"
        onConfirm={onDelete}
      />
    </>
  );
}
