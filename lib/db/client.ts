import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import path from 'node:path';

declare global {
  // eslint-disable-next-line no-var
  var __namiSql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __namiMigrated: Promise<void> | undefined;
}

export function sql() {
  if (!globalThis.__namiSql) {
    const url = process.env.DATABASE_URL ?? 'postgres://nami:nami@localhost:5432/nami';
    globalThis.__namiSql = postgres(url, { max: 10, idle_timeout: 30, onnotice: () => {} });
  }
  return globalThis.__namiSql;
}

/** Applies lib/db/schema.sql once per process (idempotent DDL). */
export function ensureSchema() {
  if (!globalThis.__namiMigrated) {
    const file = path.join(process.cwd(), 'lib/db/schema.sql');
    globalThis.__namiMigrated = sql()
      .unsafe(readFileSync(file, 'utf8'))
      .then(() => undefined)
      .catch((e) => {
        globalThis.__namiMigrated = undefined;
        throw e;
      });
  }
  return globalThis.__namiMigrated;
}
