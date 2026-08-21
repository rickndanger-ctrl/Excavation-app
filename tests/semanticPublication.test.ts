import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  PUBLICATION_SCHEMA,
  ingestSemanticPublication,
  loadSemanticPublications,
  parseSemanticPublication,
  sha256Hex,
  type SemanticPublicationEnvelope,
  type StorageLike,
} from '../src/lib/semanticPublication';

const manifestJson = fs.readFileSync(
  '/Users/richardholguin/Documents/Codex/2026-08-20/civil-plan-factory/outputs/hilyard-grading-site-prep/semantic-manifest.json',
  'utf8',
);

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

async function envelope(overrides: Partial<SemanticPublicationEnvelope> = {}): Promise<SemanticPublicationEnvelope> {
  return {
    publication_schema: PUBLICATION_SCHEMA,
    package_id: 'hilyard-apartment-test',
    package_version: 'hilyard-complete-v1',
    content_sha256: await sha256Hex(manifestJson),
    created_at: '2026-08-21T12:00:00.000Z',
    manifest_json: manifestJson,
    ...overrides,
  };
}

test('accepts an exact, checksum-bound package only after the existing semantic gates pass', async () => {
  const parsed = await parseSemanticPublication(await envelope());

  assert.equal(parsed.identity, 'hilyard-apartment-test@hilyard-complete-v1');
  assert.equal(parsed.jobsite.id, 'hilyard-apartment-test');
  assert.equal(parsed.jobsite.objects.length, 123);
  assert.equal(parsed.envelope.content_sha256, await sha256Hex(manifestJson));
});

test('rejects incomplete, incompatible, checksum-mismatched, and cross-project envelopes', async () => {
  await assert.rejects(
    parseSemanticPublication({ ...(await envelope()), content_sha256: '0'.repeat(64) }),
    /checksum/i,
  );
  await assert.rejects(
    parseSemanticPublication({ ...(await envelope()), publication_schema: 'wrong/v9' }),
    /publication schema/i,
  );
  await assert.rejects(
    parseSemanticPublication({ ...(await envelope()), package_id: 'different-project' }),
    /package_id.*manifest id/i,
  );

  const invalidManifest = JSON.parse(manifestJson) as Record<string, unknown>;
  invalidManifest.disclaimer = '';
  const invalidManifestJson = JSON.stringify(invalidManifest);
  await assert.rejects(
    parseSemanticPublication(await envelope({
      manifest_json: invalidManifestJson,
      content_sha256: await sha256Hex(invalidManifestJson),
    })),
    /not for construction/i,
  );
});

test('publishes atomically and treats only byte-identical retries as idempotent', async () => {
  const storage = new MemoryStorage();
  const publication = await envelope();

  assert.equal((await ingestSemanticPublication(storage, publication)).status, 'published');
  assert.equal((await ingestSemanticPublication(storage, publication)).status, 'already_published');
  assert.equal((await loadSemanticPublications(storage)).length, 1);

  const changedManifest = `${manifestJson}\n`;
  const conflicting = await envelope({
    manifest_json: changedManifest,
    content_sha256: await sha256Hex(changedManifest),
  });
  await assert.rejects(ingestSemanticPublication(storage, conflicting), /immutable publication conflict/i);
  assert.equal((await loadSemanticPublications(storage)).length, 1);
});

test('fails closed when the local publication cache is partial or corrupted', async () => {
  const storage = new MemoryStorage();
  storage.setItem('excavation-field-map:semantic-publications:v1', '{"not":"an array"}');
  await assert.rejects(loadSemanticPublications(storage), /publication cache/i);
});
