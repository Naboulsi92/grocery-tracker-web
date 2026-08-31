import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const ignoredDirectories = new Set([
  '.git',
  '.next',
  'blob-report',
  'coverage',
  'node_modules',
  'playwright-report',
  'test-results',
]);
const ignoredFiles = new Set(['.env.local', 'package-lock.json']);
const textExtensions = new Set([
  '.cjs', '.env', '.example', '.js', '.json', '.jsx', '.md', '.mjs', '.ts', '.tsx', '.yaml', '.yml',
]);
const secretPatterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['generic secret assignment', /(?:api[_-]?key|client[_-]?secret|password|token)\s*[:=]\s*["'][^"'\s]{12,}["']/i],
];
const e2eLiteralPatterns = [
  ['email literal in E2E', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
  ['password literal in E2E fill', /(?:password|mot de passe)[^\n]*\.fill\(\s*["'][^"']+["']/i],
];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(fullPath));
    else if (
      !ignoredFiles.has(entry.name)
      && (entry.name.startsWith('.env') || textExtensions.has(path.extname(entry.name)))
    ) files.push(fullPath);
  }

  return files;
}

export function containsServiceRoleJwt(content) {
  for (const match of content.matchAll(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g)) {
    try {
      const payload = JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString('utf8'));
      if (payload.role === 'service_role') return match.index;
    } catch {
      // Invalid JWT-shaped text is not a credential.
    }
  }
  return -1;
}

async function scan() {
  const findings = [];
  for (const file of await collectFiles(root)) {
    const content = await readFile(file, 'utf8');
    const relativePath = path.relative(root, file).replaceAll('\\', '/');
    const patterns = relativePath.startsWith('src/e2e/')
      ? [...secretPatterns, ...e2eLiteralPatterns]
      : secretPatterns;

    for (const [name, pattern] of patterns) {
      const match = pattern.exec(content);
      if (match) {
        const line = content.slice(0, match.index).split('\n').length;
        findings.push(`${relativePath}:${line}: ${name}`);
      }
    }

    const serviceRoleJwtIndex = containsServiceRoleJwt(content);
    if (serviceRoleJwtIndex >= 0) {
      const line = content.slice(0, serviceRoleJwtIndex).split('\n').length;
      findings.push(`${relativePath}:${line}: Supabase service-role JWT`);
    }
  }

  if (findings.length) {
    console.error(`Secret scan failed:\n${findings.join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log('Secret scan passed.');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await scan();
