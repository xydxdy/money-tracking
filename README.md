# Money Tracking

A multi-user personal finance web app (Next.js App Router + Postgres + Drizzle ORM + Auth.js).

## Requirements

- Node.js 22 LTS
- Docker (for local/test Postgres)

## Getting Started

```bash
npm install
cp .env.example .env
docker compose up -d postgres postgres_test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script               | Purpose                                             |
| -------------------- | ---------------------------------------------------- |
| `npm run dev`         | Start the Next.js dev server                        |
| `npm run build`       | Production build                                    |
| `npm start`           | Run the production build                            |
| `npm run lint`        | Lint with ESLint                                    |
| `npm run typecheck`   | Type-check with `tsc --noEmit`                      |
| `npm test`            | Run the Vitest suite (uses `postgres_test`)         |
| `npm run db:generate` | Generate Drizzle migrations                         |
| `npm run db:migrate`  | Apply migrations                                    |
| `npm run db:push`     | Push schema directly to the database (dev only)     |
| `npm run create-user` | CLI to create a user account                        |

## Project docs

See `docs/` for the product spec, plan, and a sample data fixture used by the import task.
