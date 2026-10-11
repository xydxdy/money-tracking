import 'dotenv/config';
import fs from 'fs';
import { previewImport } from '@/lib/import/importer';

const json = JSON.parse(fs.readFileSync('docs/finance-backup-2026-09-28.json', 'utf-8'));
const preview = previewImport(json);
console.log(JSON.stringify(preview, null, 2));
// `lib/import/importer.ts` imports `db/client.ts`, which opens a pg Pool at module load even
// though this script never queries it — exit explicitly or the open Pool keeps the process alive.
process.exit(0);
