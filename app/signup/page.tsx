import Link from 'next/link';
import { redirect } from 'next/navigation';
import { WalletIcon } from 'lucide-react';
import { auth } from '@/lib/auth';
import { isSignupEnabled } from '@/lib/users';
import { SignupForm } from './signup-form';

export default async function SignupPage() {
  if ((await auth())?.user) redirect('/dashboard');
  const enabled = isSignupEnabled();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <WalletIcon className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
            <p className="text-sm text-muted-foreground">Start tracking your money in a minute</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          {enabled ? <SignupForm /> : (
            <p className="text-sm text-muted-foreground">Sign-up is turned off for this app. Ask its owner to create an account for you.</p>
          )}
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
