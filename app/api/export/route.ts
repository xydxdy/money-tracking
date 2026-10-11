import { exportUserData } from '@/lib/export';
import { getCurrentUser } from '@/lib/session';
import { NextResponse } from 'next/server';

export async function GET() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }
  const data = await exportUserData(user.id);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="money-tracking-export-${date}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
