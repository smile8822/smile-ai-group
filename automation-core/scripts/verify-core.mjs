import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  SERVICE_BOUNDARIES,
  SMILE_AI_AUTOMATION_OWNER,
  SMILE_AI_AUTOMATION_POLICY,
  evaluateGoldScene,
  planMultipartUpload,
} from "../src/SmileAiAutomationCore.mjs";

assert.equal(SMILE_AI_AUTOMATION_OWNER, "SMILE_AI_GROUP");
assert.equal(SERVICE_BOUNDARIES.MISO.customerServiceOwner, false);
assert.equal(SMILE_AI_AUTOMATION_POLICY.customerManualSplitRequired, false);
assert.equal(SMILE_AI_AUTOMATION_POLICY.failedPipelineMayEnterGoldenRegistry, false);
assert.equal(SMILE_AI_AUTOMATION_POLICY.rejectedSceneMayEnterGoldRegistry, false);

const plan = planMultipartUpload(932683689);
assert.ok(plan.partCount > 1);
assert.ok(plan.partSizeBytes >= 5 * 1024 * 1024);

assert.equal(
  evaluateGoldScene({
    visualQualityScore: 0.9,
    stabilityScore: 0.9,
    editorialUsefulnessScore: 0.9,
    duplicateRiskScore: 0.1,
    hasBlockingOcclusion: false,
    hasSevereFocusFailure: false,
    hasSevereExposureFailure: false,
    hasCorruptFrames: false,
    isAccidentalHandlingFootage: false,
  }),
  "GOLD_CANDIDATE",
);

assert.equal(
  evaluateGoldScene({
    visualQualityScore: 0.95,
    stabilityScore: 0.95,
    editorialUsefulnessScore: 0.95,
    duplicateRiskScore: 0.05,
    hasBlockingOcclusion: true,
    hasSevereFocusFailure: false,
    hasSevereExposureFailure: false,
    hasCorruptFrames: false,
    isAccidentalHandlingFootage: false,
  }),
  "MASTER_ONLY_REJECTED",
);

const manifest = JSON.parse(
  await readFile(
    new URL("../manifests/bukangi-tiktok-live-2026-10-05.json", import.meta.url),
    "utf8",
  ),
);
assert.equal(manifest.owner, "SMILE_AI_GROUP");
assert.equal(manifest.files.length, 8);
assert.equal(new Set(manifest.files.map((item) => item.fileId)).size, 8);
assert.equal(manifest.policy.customerManualSplit, false);

console.log(JSON.stringify({
  status:"PASS",
  owner:SMILE_AI_AUTOMATION_OWNER,
  bukangiMasters:manifest.files.length,
  misoCustomerServiceOwner:SERVICE_BOUNDARIES.MISO.customerServiceOwner,
  customerManualSplit:false,
}, null, 2));
