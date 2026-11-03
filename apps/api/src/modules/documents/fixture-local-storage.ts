import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

export interface StoredFixture {
  sha256: string;
  storageKey: string;
  byteLength: number;
}

export class FixtureLocalStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
    const temporaryRoot = resolve(tmpdir());
    if (process.env.NODE_ENV !== 'test' || !this.root.startsWith(`${temporaryRoot}${sep}`)) {
      throw new Error('Fixture storage is available only in a test directory');
    }
  }

  async write(bytes: Uint8Array): Promise<StoredFixture> {
    if (bytes.byteLength < 1 || bytes.byteLength > 1024 * 1024) {
      throw new Error('Fixture must contain 1 byte to 1 MiB');
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const storageKey = `fixtures/sha256/${sha256.slice(0, 2)}/${sha256}`;
    const path = join(this.root, storageKey);
    await mkdir(dirname(path), { recursive: true });
    try {
      await writeFile(path, bytes, { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const existing = await readFile(path);
      if (createHash('sha256').update(existing).digest('hex') !== sha256) {
        throw new Error('Fixture storage hash mismatch', { cause: error });
      }
    }
    return { sha256, storageKey, byteLength: bytes.byteLength };
  }

  read(storageKey: string): Promise<Buffer> {
    if (!/^fixtures\/sha256\/[0-9a-f]{2}\/[0-9a-f]{64}$/u.test(storageKey)) {
      throw new Error('Invalid fixture storage key');
    }
    return readFile(join(this.root, storageKey));
  }
}
