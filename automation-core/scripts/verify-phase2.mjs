import assert from "node:assert/strict";

import {
  clearGoldenModuleRegistryForTests,
  registerGoldenModule,
} from "../src/GoldenModuleRegistry.mjs";
import {
  clearAssetRegistryForTests,
  listGoldAssetsForTenant,
  promoteGoldAsset,
  registerMasterAsset,
  registerRejectedScene,
} from "../src/AssetRegistry.mjs";
import { composeGoldenPipeline } from "../src/PipelineComposer.mjs";
import {
  JOB_STATUS,
  checkpointJob,
  createDurableJob,
  recordProviderReceipt,
  startJob,
  transitionJob,
} from "../src/DurableJob.mjs";

clearGoldenModuleRegistryForTests();
clearAssetRegistryForTests();

const common = {
  status: "VERIFIED",
  version: "1.0.0",
  accepts: ["VIDEO", "PHOTO", "MASTER_ASSET", "GOLD_ASSET"],
  produces: ["GOLD_ASSET", "VIDEO"],
  constraints: {
    serviceScopes: ["CUSTOMER_AI_AUTOMATION", "MISO_INTERNAL_MEDIA"],
    languages: ["ko", "id", "en", "zh", "ja"],
    platforms: ["tiktok", "instagram", "youtube", "facebook"],
  },
};

for (const [id, capability, qualityScore, estimatedUnitCost] of [
  ["LARGE_MEDIA_GOLD_V1", "LARGE_MEDIA_ASSETIZATION", 0.95, 2],
  ["ASSET_SELECT_V1", "ASSET_SELECTION", 0.94, 1],
  ["STORY_PLAN_V1", "STORY_PLANNING", 0.91, 1],
  ["CHARACTER_BIND_V1", "CHARACTER_BINDING", 0.9, 1],
  ["VOICE_BIND_V1", "VOICE", 0.92, 1],
  ["VIDEO_RENDER_V1", "VIDEO_RENDER", 0.93, 3],
  ["QC_V1", "QC", 0.99, 1],
  ["PUBLISH_V1", "PUBLISHING", 0.97, 1],
]) {
  registerGoldenModule({
    ...common,
    id,
    capabilities: [capability],
    qualityScore,
    estimatedUnitCost,
  });
}

assert.throws(
  () =>
    registerGoldenModule({
      ...common,
      id: "FAILED_EXPERIMENT",
      status: "FAILED",
      capabilities: ["VIDEO_RENDER"],
    }),
  /Only VERIFIED modules/,
);

const plan = composeGoldenPipeline({
  requestId: "request-001",
  tenantId: "customer-001",
  serviceScope: "CUSTOMER_AI_AUTOMATION",
  outputKind: "SOCIAL_SHORT",
  inputClasses: ["VIDEO"],
  language: "id",
  platform: "tiktok",
  largeMedia: true,
  requiresVoice: true,
  requiresCharacter: true,
  publish: true,
});

assert.equal(plan.owner, "SMILE_AI_GROUP");
assert.equal(plan.locked, true);
assert.deepEqual(plan.capabilities, [
  "LARGE_MEDIA_ASSETIZATION",
  "ASSET_SELECTION",
  "STORY_PLANNING",
  "CHARACTER_BINDING",
  "VOICE",
  "VIDEO_RENDER",
  "QC",
  "PUBLISHING",
]);
assert.equal(plan.moduleBindings.length, plan.capabilities.length);
assert.deepEqual(
  plan.moduleBindings.map((binding) => binding.capability),
  plan.capabilities,
);

const master = registerMasterAsset({
  assetId: "master-live-001",
  tenantId: "customer-001",
  sourceKind: "DIRECT_CUSTOMER_UPLOAD",
  storageKey: "automation/master/customer-001/live-001.mp4",
  originalName: "live.mp4",
});

assert.equal(master.state, "MASTER");

const rejected = registerRejectedScene({
  masterAssetId: master.assetId,
  startMs: 0,
  endMs: 7000,
  reasons: ["SEVERE_SHAKE", "BLOCKED_VIEW"],
});
assert.equal(rejected.reusable, false);
assert.equal(rejected.state, "REJECTED_MASTER_ONLY");

assert.throws(
  () =>
    promoteGoldAsset({
      assetId: "gold-invalid",
      masterAssetId: master.assetId,
      tenantId: "customer-001",
      storageKey: "automation/gold/customer-001/invalid.mp4",
      startMs: 10000,
      endMs: 20000,
      visualQcPassed: true,
      decodeQcPassed: false,
    }),
  /visual and decode QC/,
);

const gold = promoteGoldAsset({
  assetId: "gold-live-001",
  masterAssetId: master.assetId,
  tenantId: "customer-001",
  storageKey: "automation/gold/customer-001/live-001-10s-30s.mp4",
  startMs: 10000,
  endMs: 30000,
  tags: ["BUKANGI", "DAY", "BROLL"],
  visualQcPassed: true,
  decodeQcPassed: true,
  qualityScore: 0.93,
});
assert.equal(gold.state, "GOLD");
assert.equal(gold.sourceAssetId, master.assetId);
assert.equal(listGoldAssetsForTenant("customer-001").length, 1);

const foreignMaster = registerMasterAsset({
  assetId: "foreign-master",
  tenantId: "customer-002",
  sourceKind: "DIRECT_CUSTOMER_UPLOAD",
  storageKey: "automation/master/customer-002/foreign.mp4",
});
assert.throws(
  () =>
    promoteGoldAsset({
      assetId: "cross-tenant-gold",
      masterAssetId: foreignMaster.assetId,
      tenantId: "customer-001",
      storageKey: "automation/gold/customer-001/bad.mp4",
      startMs: 0,
      endMs: 5000,
      visualQcPassed: true,
      decodeQcPassed: true,
    }),
  /Cross-tenant/,
);

let job = createDurableJob({
  jobId: "job-001",
  requestId: plan.requestId,
  tenantId: plan.tenantId,
  plan,
});
assert.equal(job.status, JOB_STATUS.PLANNED);

job = startJob(job);
assert.equal(job.status, JOB_STATUS.RUNNING);
assert.equal(job.attempt, 1);

job = checkpointJob(job, {
  stage: "VIDEO_RENDER",
  idempotencyKey: "render:job-001:v1",
  completedModuleIds: ["LARGE_MEDIA_GOLD_V1", "ASSET_SELECT_V1"],
});
assert.equal(job.checkpoint.stage, "VIDEO_RENDER");

job = recordProviderReceipt(job, "VIDEO_RENDER_V1", {
  idempotencyKey: "render:job-001:v1",
  providerJobId: "provider-job-123",
  creditConsumed: true,
});
assert.equal(
  job.providerReceipts.VIDEO_RENDER_V1.providerJobId,
  "provider-job-123",
);

job = transitionJob(job, JOB_STATUS.QC_PENDING);
job = transitionJob(job, JOB_STATUS.COMPLETED, {
  artifacts: ["gold-live-001"],
});
assert.equal(job.status, JOB_STATUS.COMPLETED);

assert.throws(
  () => transitionJob(job, JOB_STATUS.RUNNING),
  /Invalid job transition/,
);

console.log(
  JSON.stringify(
    {
      status: "PASS",
      owner: "SMILE_AI_GROUP",
      goldenModules: 8,
      pipelineModules: plan.moduleBindings.length,
      tenantIsolation: "PASS",
      goldQcGate: "PASS",
      durableCheckpointRecoveryContract: "PASS",
    },
    null,
    2,
  ),
);
