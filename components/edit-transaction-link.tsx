import Link from 'next/link';
import { PencilIcon } from 'lucide-react';

/** Small pencil link straight to a transaction's edit form; sits beside a row's view link. */
export function EditTransactionLink({ id, details }: { id: string; details: string }) {
  return (
    <Link
      href={`/transactions/${id}/edit`}
      aria-label={`Edit ${details}`}
      title="Edit"
      className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <PencilIcon className="size-4" />
    </Link>
  );
}
