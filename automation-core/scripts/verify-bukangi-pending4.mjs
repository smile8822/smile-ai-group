#!/usr/bin/env node
// Read-only validation. Does not import media, publish, or log credentials.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const EXPECTED = new Map([
  ['1xN0eDHGcjWBscNOq13PBL_duujEtrDcj', { sizeBytes: 837276607, duration: '61:31' }],
  ['18fey6JT2DxICxjUjeM1tou-Fbka-vRKR', { sizeBytes: 561251629, duration: '26:35' }],
  ['1ezEWeBFWxYV3iaXB13lYBMpDq_Slm4nr', { sizeBytes: 872279796, duration: '80:35' }],
  ['1TfcFZu-281lRkN9RLyM7X5KV-uSrtGrB', { sizeBytes: 932683689, duration: '55:14' }],
]);
const fallback = new URL('../manifests/bukangi-tiktok-live-2026-10-05.json', import.meta.url);
const pos = process.argv.indexOf('--manifest');
assert.ok(pos < 0 || process.argv[pos + 1], 'Use --manifest <file>');
const manifest = JSON.parse(await readFile(pos < 0 ? fallback : process.argv[pos + 1], 'utf8'));

assert.equal(manifest.owner, 'SMILE_AI_GROUP', 'Wrong storage owner');
assert.equal(manifest.workload, 'BUKANGI_TIKTOK_LIVE');
assert.equal(manifest.files?.length, 8, 'Eight original MASTER records required');
assert.equal(new Set(manifest.files.map(f => f.fileId)).size, 8, 'Duplicate source IDs');
assert.equal(manifest.policy?.masterImmutable, true);
assert.equal(manifest.policy?.onlyQcPassedScenesBecomeGold, true);
const pending = manifest.files.filter(f => f.goldStatus === 'PENDING_GROUP_CORE_ANALYSIS');
assert.equal(pending.length, 4, 'Exactly four source masters should be pending');
for (const f of pending) {
  const expected = EXPECTED.get(f.fileId);
  assert.ok(expected, 'Unrecognized pending source');
  assert.equal(f.sizeBytes, expected.sizeBytes, 'Source size drift');
  assert.equal(f.duration, expected.duration, 'Source duration drift');
  assert.ok(f.name.endsWith('.mp4'));
}
for (const id of EXPECTED.keys()) assert.ok(pending.some(f => f.fileId === id));
const total = pending.reduce((n, f) => n + f.sizeBytes, 0);
assert.equal(total, 3203491721);

const keys = [
  'SMILE_AI_AUTOMATION_GOOGLE_DRIVE_ACCESS_TOKEN',
  'SMILE_AI_AUTOMATION_BUCKET',
  'SMILE_AI_AUTOMATION_REGION',
  'SMILE_AI_AUTOMATION_ACCESS_KEY_ID',
  'SMILE_AI_AUTOMATION_SECRET_ACCESS_KEY',
];
const checkEnv = process.argv.includes('--check-env');
const missing = keys.filter(k => !process.env[k]?.trim());
console.log(JSON.stringify({
  status: 'MANIFEST_PASS_IMPORT_NOT_EXECUTED',
  owner: manifest.owner,
  sourceCount: manifest.files.length,
  pendingCount: pending.length,
  pendingBytes: total,
  pendingSourceIds: pending.map(f => f.fileId),
  credentialPresence: checkEnv ? { allPresent: !missing.length, missingNames: missing } : 'NOT_CHECKED',
  nextCommand: 'node scripts/import-google-drive-large-media.mjs --manifest manifests/bukangi-tiktok-live-2026-10-05.json --only-pending',
  nextGates: ['private object upload + byte count', 'source/object checksum equality', 'full decode', 'scene QC', 'GOLD approval'],
  objectStorageVerified: false,
  transferCompleted: false,
}, null, 2));
if (checkEnv && missing.length) process.exitCode = 2;
