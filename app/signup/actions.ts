'use server';
import { AuthError } from 'next-auth';
import { signIn } from '@/lib/auth';
import { registerUser, signupInput, isSignupEnabled } from '@/lib/users';

export type SignupState = { error?: string; fieldErrors?: Partial<Record<'name' | 'email' | 'password' | 'confirmPassword', string>> };

/** Creates the account, then signs the new user in (redirecting to the dashboard). */
export async function signupAction(_prev: SignupState | undefined, formData: FormData): Promise<SignupState> {
  if (!isSignupEnabled()) return { error: 'Sign-up is turned off. Ask the owner of this app for an account.' };

  const parsed = signupInput.safeParse({
    name: String(formData.get('name') ?? '') || undefined,
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
  });
  if (!parsed.success) {
    const fieldErrors: SignupState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<SignupState['fieldErrors']>;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  try {
    await registerUser(parsed.data);
  } catch (err) {
    if (err instanceof Error && err.message === 'EMAIL_TAKEN') {
      return { fieldErrors: { email: 'An account with this email already exists. Try signing in.' } };
    }
    return { error: 'Could not create your account. Please try again.' };
  }

  try {
    await signIn('credentials', { email: parsed.data.email, password: parsed.data.password, redirectTo: '/dashboard' });
  } catch (err) {
    if (err instanceof AuthError) return { error: 'Your account was created, but signing in failed. Please sign in.' };
    throw err; // the redirect after a successful sign-in
  }
  return {};
}
