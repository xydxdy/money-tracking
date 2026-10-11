'use client';
import { useSyncExternalStore } from 'react';
import { MoonIcon, SunIcon } from 'lucide-react';

// The initial `dark` class is applied before hydration by the inline script in app/layout.tsx.
// The <html> class list is the single source of truth; this component just observes it.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}
const isDark = () => document.documentElement.classList.contains('dark');

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      // Storage unavailable (e.g. private mode) — the toggle still works for this page view.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
    >
      {dark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
      {dark ? 'Light mode' : 'Dark mode'}
    </button>
  );
}
