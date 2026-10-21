'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { signIn } from '@/lib/auth';
import { AuthError } from 'next-auth';
import { isSessionTokenCookie } from '@/lib/remember-me';

export async function loginAction(formData: FormData) {
  const remember = formData.get('remember') === 'on';
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      remember: String(remember),
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: 'Invalid email or password' };
    }
    throw err;
  }

  if (!remember) {
    // Re-set the session cookie without an expiry so it ends with the browser session.
    const jar = await cookies();
    for (const { name, value } of jar.getAll()) {
      if (!isSessionTokenCookie(name) || !value) continue;
      jar.set(name, value, { httpOnly: true, sameSite: 'lax', path: '/', secure: name.startsWith('__Secure-') });
    }
  }
  redirect('/dashboard');
}

/** `useActionState` form of loginAction: returns the error to show, or redirects on success. */
export async function loginFormAction(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  return (await loginAction(formData)) ?? {};
}
