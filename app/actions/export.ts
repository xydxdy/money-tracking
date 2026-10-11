'use server';
import { exportUserData } from '@/lib/export';
import { getCurrentUser } from '@/lib/session';

export async function exportDataAction() {
  const user = await getCurrentUser();
  return exportUserData(user.id);
}
