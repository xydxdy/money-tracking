import { redirect } from 'next/navigation';

// Categories moved to Settings; keep old links and bookmarks working.
export default function CategoriesRedirect() {
  redirect('/settings/categories');
}
