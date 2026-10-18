import { mkdtemp, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { renameWithRetry } from '../fs-atomic';

type RenameCalls = { n: number; args: Array<[string, string]> };

/**
 * Deterministic rename stand-in: pops `script` per call, 'ok' (or exhausted
 * script) resolves, anything else rejects with that errno code.
 */
function fakeRename(script: string[], calls: RenameCalls): typeof rename {
  return ((tmp: string, target: string) => {
    calls.n += 1;
    calls.args.push([tmp, target]);
    const step = script.shift();
    if (!step || step === 'ok') return Promise.resolve();
    return Promise.reject(Object.assign(new Error(step), { code: step }));
  }) as unknown as typeof rename;
}

describe('renameWithRetry (injected rename)', () => {
  it('resolves on the first success without retrying', async () => {
    const calls: RenameCalls = { n: 0, args: [] };
    await renameWithRetry('a.tmp', 'a.json', fakeRename(['ok'], calls));
    expect(calls.n).toBe(1);
    expect(calls.args[0]).toEqual(['a.tmp', 'a.json']);
  });

  it('retries on EPERM and lets the later attempt succeed', async () => {
    const calls: RenameCalls = { n: 0, args: [] };
    await renameWithRetry('a.tmp', 'a.json', fakeRename(['EPERM', 'EPERM', 'ok'], calls));
    expect(calls.n).toBe(3);
  });

  it('retries EACCES and EBUSY the same way', async () => {
    for (const code of ['EACCES', 'EBUSY']) {
      const calls: RenameCalls = { n: 0, args: [] };
      await renameWithRetry('a.tmp', 'a.json', fakeRename([code, 'ok'], calls));
      expect(calls.n).toBe(2);
    }
  });

  it('rethrows a non-retryable error on the first failure', async () => {
    const calls: RenameCalls = { n: 0, args: [] };
    await expect(
      renameWithRetry('a.tmp', 'a.json', fakeRename(['ENOENT'], calls)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    expect(calls.n).toBe(1);
  });

  it('propagates the original error once the retry budget is exhausted', async () => {
    const calls: RenameCalls = { n: 0, args: [] };
    const alwaysFails = fakeRename(new Array(99).fill('EBUSY'), calls);
    await expect(renameWithRetry('a.tmp', 'a.json', alwaysFails)).rejects.toMatchObject({
      code: 'EBUSY',
    });
    // attempt indexes 0..6, the 7th failure trips `attempt >= MAX_ATTEMPTS`.
    expect(calls.n).toBe(7);
  }, 15_000);
});

const describeOnWindows = process.platform === 'win32' ? describe : describe.skip;

describeOnWindows('renameWithRetry on real NTFS (Windows)', () => {
  it('raw rename rejects while the target handle is held, then a bounded retry rescues', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'fs-atomic-'));
    try {
      const target = path.join(dir, 'stamp.json');
      await writeFile(target, 'held', 'utf8');
      const handle = await open(target, 'r+');
      const tmp = path.join(dir, 'stamp.json.tmp-x');
      await writeFile(tmp, 'fresh', 'utf8');

      // Premise of ticket #242: with a live handle on the target, the bare
      // fs.rename rejects on NTFS while POSIX would swap silently.
      let premiseCode: string | undefined;
      try {
        await rename(tmp, target);
      } catch (error) {
        premiseCode = (error as NodeJS.ErrnoException).code;
      }
      expect(premiseCode).toMatch(/^(EPERM|EACCES|EBUSY)$/);

      // The bounded retry rides the short handle window out (release ~80ms).
      setTimeout(() => {
        void handle.close();
      }, 80);
      await renameWithRetry(tmp, target);

      expect(await readFile(target, 'utf8')).toBe('fresh');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 15_000);
});
