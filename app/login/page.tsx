import { WalletIcon } from 'lucide-react';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <WalletIcon className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Money Tracking</h1>
            <p className="text-sm text-muted-foreground">Sign in to your account</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
