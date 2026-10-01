/**
 * CSS custom-property contract (issue #190).
 *
 * Every `var(--token)` used WITHOUT a fallback in our styles must resolve to
 * a definition — an undefined token voids the whole declaration at
 * computed-value time, silently deleting animations/transitions everywhere.
 * That is exactly how `--ease-out`/`--ease-in-out` shipped used 22x but
 * defined 0x, killing the whole motion system with zero console errors.
 */
import fs from 'node:fs';
import path from 'node:path';

// Tokens injected at runtime (not present in any .css file).
// next/font (src/app/fonts.ts) defines these on <html>.
const RUNTIME_PROVIDED = new Set(['font-body', 'font-display']);

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, out);
    } else if (/\.(css|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('CSS custom-property contract (#190)', () => {
  it('every fallback-less var(--token) resolves to a definition', () => {
    const srcDir = path.join(__dirname, '..', '..', 'src');
    const defined = new Set<string>();
    const used = new Map<string, string[]>();

    for (const file of collectFiles(srcDir)) {
      const raw = fs.readFileSync(file, 'utf8');
      const content = raw.replace(/\/\*[\s\S]*?\*\//g, '');
      for (const match of content.matchAll(/--([\w-]+)\s*:/g)) {
        defined.add(match[1]);
      }
      for (const match of content.matchAll(/var\(\s*--([\w-]+)\s*\)/g)) {
        const token = match[1];
        if (!used.has(token)) used.set(token, []);
        used.get(token)!.push(path.relative(srcDir, file));
      }
    }

    const undefinedTokens = [...used.keys()].filter(
      (token) => !defined.has(token) && !RUNTIME_PROVIDED.has(token),
    );

    expect(
      undefinedTokens.map((token) => `${token} (used in ${used.get(token)!.slice(0, 3).join(', ')})`),
    ).toEqual([]);
  });

  it('motion tokens carry the plan-003 curves', () => {
    const globals = fs.readFileSync(
      path.join(__dirname, '..', '..', 'src', 'app', 'globals.css'),
      'utf8',
    );
    expect(globals).toMatch(/--ease-out:\s*cubic-bezier\(0\.23,\s*1,\s*0\.32,\s*1\)/);
    expect(globals).toMatch(/--ease-in-out:\s*cubic-bezier\(0\.77,\s*0,\s*0\.175,\s*1\)/);
  });
});
