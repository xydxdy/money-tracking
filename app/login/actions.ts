'use server';
import { signIn } from '@/lib/auth';
import { AuthError } from 'next-auth';

export async function loginAction(formData: FormData) {
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/dashboard',
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: 'Invalid email or password' };
    }
    throw err;
  }
}
