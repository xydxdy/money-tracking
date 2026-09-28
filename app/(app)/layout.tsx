import type { ReactNode } from 'react';
import { Nav } from '@/components/nav';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <Nav />
      <main className="overflow-y-auto p-6">{children}</main>
    </div>
  );
}
