'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateName, updateEmail, changePassword } from '@/app/actions/profile';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const MESSAGES: Record<string, string> = {
  WRONG_PASSWORD: 'Your current password is incorrect.',
  EMAIL_TAKEN: 'Another account already uses that email.',
};

function describe(err: unknown, fallback: string) {
  if (err instanceof Error) {
    if (MESSAGES[err.message]) return MESSAGES[err.message];
    if ((err as { name?: string }).name === 'ZodError') {
      try {
        const issues = JSON.parse(err.message) as { message?: string; path?: string[] }[];
        if (issues[0]?.path?.[0] === 'email') return 'Enter a valid email address.';
        if (issues[0]?.message) return issues[0].message;
      } catch { /* fall through */ }
    }
  }
  return fallback;
}

function Card({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 shadow-xs">
      <div>
        <h2 className="font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function useStatus() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  async function run(action: () => Promise<void>, ok: string, fallback: string) {
    setPending(true); setError(null); setDone(null);
    try { await action(); setDone(ok); return true; }
    catch (err) { setError(describe(err, fallback)); return false; }
    finally { setPending(false); }
  }
  const status = (
    <>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {done && <p role="status" className="text-sm text-positive">{done}</p>}
    </>
  );
  return { pending, run, status };
}

export function ProfileForms({ name, email }: { name: string | null; email: string }) {
  const router = useRouter();
  const nameForm = useStatus();
  const emailForm = useStatus();
  const passwordForm = useStatus();
  const [passwordKey, setPasswordKey] = useState(0);
  const [emailKey, setEmailKey] = useState(0);

  return (
    <div className="space-y-4">
      <Card title="Name" description="Shown in the sidebar.">
        <form className="space-y-3" action={async (fd) => {
          if (await nameForm.run(() => updateName({ name: String(fd.get('name') ?? '') }), 'Name saved.', 'Could not save your name.')) router.refresh();
        }}>
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input id="profile-name" name="name" defaultValue={name ?? ''} maxLength={80} autoComplete="name" />
          </div>
          {nameForm.status}
          <Button type="submit" disabled={nameForm.pending}>{nameForm.pending ? 'Saving…' : 'Save name'}</Button>
        </form>
      </Card>

      <Card title="Email" description={`You sign in with ${email}. Confirm the change with your current password.`}>
        <form key={emailKey} className="space-y-3" action={async (fd) => {
          const ok = await emailForm.run(
            () => updateEmail({ email: String(fd.get('email') ?? ''), currentPassword: String(fd.get('currentPassword') ?? '') }),
            'Email updated. Use it the next time you sign in.', 'Could not change your email.');
          if (ok) { setEmailKey((k) => k + 1); router.refresh(); }
        }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-email">New email</Label>
              <Input id="profile-email" name="email" type="email" required autoComplete="email" placeholder={email} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email-password">Current password</Label>
              <Input id="profile-email-password" name="currentPassword" type="password" required autoComplete="current-password" />
            </div>
          </div>
          {emailForm.status}
          <Button type="submit" disabled={emailForm.pending}>{emailForm.pending ? 'Saving…' : 'Change email'}</Button>
        </form>
      </Card>

      <Card title="Password" description="Use at least 8 characters.">
        <form key={passwordKey} className="space-y-3" action={async (fd) => {
          const next = String(fd.get('newPassword') ?? '');
          if (next !== String(fd.get('confirmPassword') ?? '')) {
            await passwordForm.run(async () => { throw new Error('MISMATCH'); }, '', 'The new passwords don’t match.');
            return;
          }
          const ok = await passwordForm.run(
            () => changePassword({ currentPassword: String(fd.get('currentPassword') ?? ''), newPassword: next }),
            'Password changed.', 'Could not change your password.');
          if (ok) setPasswordKey((k) => k + 1);
        }}>
          <div className="space-y-2">
            <Label htmlFor="profile-current-password">Current password</Label>
            <Input id="profile-current-password" name="currentPassword" type="password" required autoComplete="current-password" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-new-password">New password</Label>
              <Input id="profile-new-password" name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-confirm-password">Confirm new password</Label>
              <Input id="profile-confirm-password" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
            </div>
          </div>
          {passwordForm.status}
          <Button type="submit" disabled={passwordForm.pending}>{passwordForm.pending ? 'Saving…' : 'Change password'}</Button>
        </form>
      </Card>
    </div>
  );
}
