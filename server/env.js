// Loads .env (Node 20.12+ built-in). Imported first so every other module sees the values.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);
