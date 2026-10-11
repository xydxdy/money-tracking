'use client';
import { useActionState } from 'react';
import { signupAction } from './actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">Name <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Input id="name" name="name" autoComplete="name" maxLength={80} autoFocus />
        <FieldError message={fe.name} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" aria-invalid={!!fe.email} />
        <FieldError message={fe.email} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" aria-invalid={!!fe.password} />
        <FieldError message={fe.password ?? undefined} />
        {!fe.password && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" aria-invalid={!!fe.confirmPassword} />
        <FieldError message={fe.confirmPassword} />
      </div>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Creating account…' : 'Create account'}</Button>
    </form>
  );
}
