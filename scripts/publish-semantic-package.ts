import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SEMANTIC_PUBLICATIONS_KEY,
  ingestSemanticPublication,
  type StorageLike,
} from '../src/lib/semanticPublication';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inboxPath = path.join(repositoryRoot, 'public', 'semantic-publications.local.json');

class InboxStorage implements StorageLike {
  value: string | null;
  constructor(value: string | null) { this.value = value; }
  getItem(key: string) { return key === SEMANTIC_PUBLICATIONS_KEY ? this.value : null; }
  setItem(key: string, value: string) {
    if (key !== SEMANTIC_PUBLICATIONS_KEY) throw new Error(`Unexpected storage key ${key}.`);
    this.value = value;
  }
}

async function main() {
  const sourcePath = process.argv[2];
  if (!sourcePath) {
    throw new Error('Usage: npm run publish:local -- /absolute/path/to/semantic-publication.json');
  }
  const sourceText = await fs.readFile(path.resolve(sourcePath), 'utf8');
  const input = JSON.parse(sourceText) as unknown;
  const existing = await fs.readFile(inboxPath, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  const storage = new InboxStorage(existing);
  const result = await ingestSemanticPublication(storage, input);
  if (!storage.value) throw new Error('Publication adapter produced an empty inbox.');

  const temporaryPath = `${inboxPath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${storage.value}\n`, { encoding: 'utf8', flag: 'wx' });
  await fs.rename(temporaryPath, inboxPath);
  process.stdout.write(`${result.status}: ${result.publication.identity} ${result.publication.envelope.content_sha256}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
