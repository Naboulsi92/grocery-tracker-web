import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REALTIME_TABLES } from '../../src/hooks/useHouseholdRealtime';

const REPO_ROOT = join(__dirname, '..', '..');
const SRC_ROOT = join(REPO_ROOT, 'src');
// Mirrors the `supabase_realtime` publication membership enforced DB-side by
// supabase/tests/database/security_contract.sql:13.
const PUBLISHED_TABLES = ['categories', 'items'];

function sourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, files);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

describe('realtime publication guard (ticket #123)', () => {
  it('freezes the realtime table allowlist to the publication {categories, items}', () => {
    expect([...REALTIME_TABLES]).toEqual(PUBLISHED_TABLES);
  });

  it('opens realtime channels only from useHouseholdRealtime (zero ad-hoc pipelines)', () => {
    const offenders = sourceFiles(SRC_ROOT)
      .filter((file) => file !== join(SRC_ROOT, 'hooks', 'useHouseholdRealtime.ts'))
      .filter((file) => readFileSync(file, 'utf8').includes('.channel('))
      .map((file) => relative(REPO_ROOT, file));
    expect(offenders).toEqual([]);
  });

  it('binds postgres_changes only on published tables', () => {
    const bad: string[] = [];
    for (const file of sourceFiles(SRC_ROOT)) {
      const content = readFileSync(file, 'utf8');
      const binding = /table:\s*'([^']+)'/g;
      let match: RegExpExecArray | null;
      while ((match = binding.exec(content)) !== null) {
        if (!PUBLISHED_TABLES.includes(match[1])) {
          bad.push(`${relative(REPO_ROOT, file)}: ${match[1]}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
