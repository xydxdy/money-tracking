import type { ReactNode } from 'react';
import { PageHeader } from '@/components/page-header';
import { SettingsTabs } from '@/components/settings-tabs';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" />
      <SettingsTabs />
      {children}
    </div>
  );
}
