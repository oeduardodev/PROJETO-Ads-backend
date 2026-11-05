import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
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

  identify(bytes: Uint8Array): StoredFixture {
    if (bytes.byteLength < 1 || bytes.byteLength > 1024 * 1024) {
      throw new Error('Fixture must contain 1 byte to 1 MiB');
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const storageKey = `fixtures/sha256/${sha256.slice(0, 2)}/${sha256}`;
    return { sha256, storageKey, byteLength: bytes.byteLength };
  }

  async write(bytes: Uint8Array): Promise<StoredFixture> {
    const stored = this.identify(bytes);
    const path = this.path(stored.storageKey);
    await mkdir(dirname(path), { recursive: true });
    try {
      await writeFile(path, bytes, { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const existing = await readFile(path);
      if (createHash('sha256').update(existing).digest('hex') !== stored.sha256) {
        throw new Error('Fixture storage hash mismatch', { cause: error });
      }
    }
    return stored;
  }

  read(storageKey: string): Promise<Buffer> {
    return readFile(this.path(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    try {
      await unlink(this.path(storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  private path(storageKey: string): string {
    if (!/^fixtures\/sha256\/[0-9a-f]{2}\/[0-9a-f]{64}$/u.test(storageKey)) {
      throw new Error('Invalid fixture storage key');
    }
    return join(this.root, storageKey);
  }
}
