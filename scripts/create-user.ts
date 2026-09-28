import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { db } from '@/db/client';
import { users } from '@/db/schema';

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx === -1 ? undefined : process.argv[idx + 1];
}

export async function createUser(email: string, password: string, name?: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(users).values({ email, passwordHash, name }).returning();
  return user;
}

async function main() {
  const email = arg('email');
  const password = arg('password');
  const name = arg('name');
  if (!email || !password) {
    console.error('Usage: npm run create-user -- --email you@example.com --password secret [--name "Your Name"]');
    process.exit(1);
  }
  const user = await createUser(email, password, name);
  console.log(`Created user ${user.email} (${user.id})`);
  process.exit(0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
