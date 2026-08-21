import type { JobsitePackage } from '../types/jobsite';
import { parseSemanticJobsiteManifest } from './semanticPackageAdapter';

export const PUBLICATION_SCHEMA = 'excavation-field-map.semantic-publication/v1';
export const SEMANTIC_PUBLICATIONS_KEY = 'excavation-field-map:semantic-publications:v1';
const MAX_MANIFEST_BYTES = 20 * 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const IDENTITY_PART_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

export type SemanticPublicationEnvelope = {
  publication_schema: typeof PUBLICATION_SCHEMA;
  package_id: string;
  package_version: string;
  content_sha256: string;
  created_at: string;
  manifest_json: string;
};

export type ParsedSemanticPublication = {
  identity: string;
  envelope: SemanticPublicationEnvelope;
  jobsite: JobsitePackage;
};

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function object(input: unknown, label: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return input as Record<string, unknown>;
}

function requiredString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Semantic publication requires ${key}.`);
  }
  return value;
}

function envelopeFromUnknown(input: unknown): SemanticPublicationEnvelope {
  const source = object(input, 'Semantic publication');
  const allowed = new Set([
    'publication_schema', 'package_id', 'package_version', 'content_sha256', 'created_at', 'manifest_json',
  ]);
  const extra = Object.keys(source).find((key) => !allowed.has(key));
  if (extra) throw new Error(`Semantic publication contains unsupported field ${extra}.`);

  const publicationSchema = requiredString(source, 'publication_schema');
  if (publicationSchema !== PUBLICATION_SCHEMA) {
    throw new Error(`Unsupported publication schema: ${publicationSchema}.`);
  }
  const packageId = requiredString(source, 'package_id');
  const packageVersion = requiredString(source, 'package_version');
  if (packageId.length > 200 || packageVersion.length > 200
    || !IDENTITY_PART_PATTERN.test(packageId) || !IDENTITY_PART_PATTERN.test(packageVersion)) {
    throw new Error('Semantic publication package identity must use 1-200 letters, numbers, dots, underscores, colons, slashes, or hyphens.');
  }
  const contentSha256 = requiredString(source, 'content_sha256');
  if (!SHA256_PATTERN.test(contentSha256)) {
    throw new Error('Semantic publication content_sha256 must be 64 lowercase hexadecimal characters.');
  }
  const createdAt = requiredString(source, 'created_at');
  if (!ISO_TIMESTAMP_PATTERN.test(createdAt) || !Number.isFinite(Date.parse(createdAt))) {
    throw new Error('Semantic publication created_at must be an ISO-8601 timestamp.');
  }
  const manifestJson = requiredString(source, 'manifest_json');
  if (new TextEncoder().encode(manifestJson).byteLength > MAX_MANIFEST_BYTES) {
    throw new Error('Semantic publication manifest_json exceeds the 20 MiB limit.');
  }

  return {
    publication_schema: PUBLICATION_SCHEMA,
    package_id: packageId,
    package_version: packageVersion,
    content_sha256: contentSha256,
    created_at: createdAt,
    manifest_json: manifestJson,
  };
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function parseSemanticPublication(input: unknown): Promise<ParsedSemanticPublication> {
  const envelope = envelopeFromUnknown(input);
  const actualChecksum = await sha256Hex(envelope.manifest_json);
  if (actualChecksum !== envelope.content_sha256) {
    throw new Error(`Semantic publication checksum mismatch: expected ${envelope.content_sha256}, received ${actualChecksum}.`);
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(envelope.manifest_json) as unknown;
  } catch {
    throw new Error('Semantic publication manifest_json is not valid JSON.');
  }
  const jobsite = parseSemanticJobsiteManifest(manifest);
  if (jobsite.id !== envelope.package_id) {
    throw new Error(`Semantic publication package_id ${envelope.package_id} does not match manifest id ${jobsite.id}.`);
  }

  return {
    identity: `${envelope.package_id}@${envelope.package_version}`,
    envelope,
    jobsite,
  };
}

function readCachedEnvelopes(storage: StorageLike): unknown[] {
  const raw = storage.getItem(SEMANTIC_PUBLICATIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new Error('not an array');
    return parsed;
  } catch {
    throw new Error('Local semantic publication cache is partial or corrupted.');
  }
}

export async function loadSemanticPublications(storage: StorageLike): Promise<ParsedSemanticPublication[]> {
  const parsed = await Promise.all(readCachedEnvelopes(storage).map(parseSemanticPublication));
  return parsed.sort((a, b) => Date.parse(b.envelope.created_at) - Date.parse(a.envelope.created_at));
}

export async function ingestSemanticPublication(
  storage: StorageLike,
  input: unknown,
): Promise<{ status: 'published' | 'already_published'; publication: ParsedSemanticPublication }> {
  const publication = await parseSemanticPublication(input);
  const cached = await loadSemanticPublications(storage);
  const prior = cached.find((item) => item.identity === publication.identity);
  if (prior) {
    if (prior.envelope.content_sha256 !== publication.envelope.content_sha256) {
      throw new Error(`Immutable publication conflict for ${publication.identity}. Use a new package_version for changed content.`);
    }
    return { status: 'already_published', publication: prior };
  }

  // A single localStorage replacement is the local adapter's atomic commit boundary.
  storage.setItem(
    SEMANTIC_PUBLICATIONS_KEY,
    JSON.stringify([publication.envelope, ...cached.map((item) => item.envelope)]),
  );
  return { status: 'published', publication };
}
