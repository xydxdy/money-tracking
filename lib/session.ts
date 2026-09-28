import { auth } from '@/lib/auth';

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('UNAUTHENTICATED');
  }
  return { id: session.user.id, email: session.user.email!, name: session.user.name ?? null };
}
