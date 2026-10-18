import { rename } from 'node:fs/promises';

const RENAME_RETRY_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);
const RENAME_RETRY_MAX_ATTEMPTS = 6;
const RENAME_RETRY_BASE_MS = 20;

function renameRetryDelayMs(attempt: number): number {
  return RENAME_RETRY_BASE_MS * 2 ** attempt + Math.random() * RENAME_RETRY_BASE_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Windows-only transient: fs.rename over a target held open by another
// worker (short storageState read handle) fails with EPERM/EACCES/EBUSY on
// NTFS while POSIX accepts it (ticket #242). The tmp file is already
// written and its path is unique, so only the rename is retried — with a
// bounded exponential backoff; the final error still propagates unmasked.
export async function renameWithRetry(
  tmp: string,
  target: string,
  renameFn: typeof rename = rename,
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await renameFn(tmp, target);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | null)?.code ?? '';
      if (!RENAME_RETRY_CODES.has(code) || attempt >= RENAME_RETRY_MAX_ATTEMPTS) {
        throw error;
      }
      await sleep(renameRetryDelayMs(attempt));
    }
  }
}
