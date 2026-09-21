import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const MIN_SUITES = 26;
export const MIN_TESTS = 280;
const JEST_ARGS = ['jest', '--runInBand', 'quality', 'src', '--json', '--silent'];

export function checkCounts(
  { suites, tests },
  { minSuites = MIN_SUITES, minTests = MIN_TESTS } = {},
) {
  const errors = [];
  if (!Number.isInteger(suites) || suites < minSuites) {
    errors.push(`suites Jest insuffisantes: ${suites} < ${minSuites}`);
  }
  if (!Number.isInteger(tests) || tests < minTests) {
    errors.push(`tests Jest insuffisants: ${tests} < ${minTests}`);
  }
  return errors;
}

function jestCommand() {
  return {
    cmd: process.execPath,
    args: [
      path.join(process.cwd(), 'node_modules', 'jest', 'bin', 'jest.js'),
      ...JEST_ARGS.slice(1),
    ],
  };
}

function runJestJson() {
  const { cmd, args } = jestCommand();
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { cwd: process.cwd(), maxBuffer: 64 * 1024 * 1024, timeout: 600000 },
      (error, stdout, stderr) => {
        const output = (stdout ?? '').trim();
        const start = output.indexOf('{');
        if (start < 0) {
          reject(
            new Error(
              `Sortie JSON Jest introuvable.${error ? ` Erreur: ${error.message}` : ''}${stderr ? ` Stderr: ${String(stderr).slice(-2000)}` : ''}`,
            ),
          );
          return;
        }
        try {
          resolve(JSON.parse(output.slice(start)));
        } catch (parseError) {
          reject(
            new Error(
              `JSON Jest invalide: ${parseError.message}. Stderr: ${String(stderr).slice(-2000)}`,
            ),
          );
        }
      },
    );
  });
}

async function loadCountsFromFile(filePath) {
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);
  const raw = await readFile(absolute, 'utf8');
  return JSON.parse(raw);
}

function toCounts(results) {
  return {
    suites: results.numTotalTestSuites,
    tests: results.numTotalTests,
  };
}

async function main() {
  const [jsonFile] = process.argv.slice(2);
  const results = jsonFile ? await loadCountsFromFile(jsonFile) : await runJestJson();
  const counts = toCounts(results);
  const errors = checkCounts(counts);
  if (errors.length > 0) {
    console.error(
      `Garde-fou Jest ECHEC — suites: ${counts.suites}, tests: ${counts.tests} (attendu ≥${MIN_SUITES} suites, ≥${MIN_TESTS} tests).\n${errors.join('\n')}`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `Garde-fou Jest OK — suites: ${counts.suites}, tests: ${counts.tests} (seuils ≥${MIN_SUITES}/≥${MIN_TESTS}).`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
