import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REALTIME_TABLES } from '../../src/hooks/useHouseholdRealtime';

const REPO_ROOT = join(__dirname, '..', '..');
const SRC_ROOT = join(REPO_ROOT, 'src');
// Mirrors the `supabase_realtime` publication membership enforced DB-side by
// supabase/tests/database/security_contract.sql:13.
const PUBLISHED_TABLES = ['categories', 'household_members', 'items'];
// Files allowed to open realtime channels: the inventory pipeline (#123)
// plus the live roster (#173). Anything else is an ad-hoc pipeline.
const CHANNEL_OWNERS = [
  join(SRC_ROOT, 'hooks', 'useHouseholdRealtime.ts'),
  join(SRC_ROOT, 'hooks', 'useHouseholdMembersLive.ts'),
];

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

describe('realtime publication guard (tickets #123 + #173)', () => {
  it('freezes the inventory pipeline allowlist to {categories, items}', () => {
    expect([...REALTIME_TABLES]).toEqual(['categories', 'items']);
  });

  it('publishes exactly the pipeline tables plus the live roster', () => {
    expect(PUBLISHED_TABLES).toEqual(['categories', 'household_members', 'items']);
    for (const table of REALTIME_TABLES) {
      expect(PUBLISHED_TABLES).toContain(table);
    }
  });

  it('opens realtime channels only from the pipeline owners (zero ad-hoc pipelines)', () => {
    const offenders = sourceFiles(SRC_ROOT)
      .filter((file) => !CHANNEL_OWNERS.includes(file))
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
