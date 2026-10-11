import type { ReactNode } from 'react';

const TONES = {
  default: 'bg-primary/10 text-primary',
  positive: 'bg-positive/15 text-positive',
  negative: 'bg-destructive/10 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
} as const;

export function StatCard({ label, value, icon, tone = 'default', hint }: {
  label: string; value: ReactNode; icon: ReactNode; tone?: keyof typeof TONES; hint?: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm text-muted-foreground" title={label}>{label}</p>
        <span className={`inline-flex size-8 items-center justify-center rounded-lg [&_svg]:size-4 ${TONES[tone]}`}>{icon}</span>
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight break-words tabular-nums sm:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
