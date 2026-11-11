import assert from "node:assert/strict";
import { createCreativeExecutionSpec } from "../src/CreativeDirector.mjs";

const caseUrl = "https://ads.tiktok.com/business/en-US/inspiration/bvg-x-gud-berlin-tiktok-success-stories";
const externalSuccessBundle = {
  reviewedAt: "2026-11-11T09:00:00Z",
  cases: [{
    id: "TIKTOK_BVG_OFFICIAL_CAMPAIGN",
    verified: true,
    platform: "tiktok",
    country: "DE",
    contentClass: "COMMUNITY_HUMOR",
    distribution: "MIXED",
    sourceUrl: caseUrl,
    observedAt: "2026-11-11T08:00:00Z",
    visualReviewStatus: "CASE_DESCRIPTION_ONLY",
    metrics: [{ name: "watch_time", value: 25.08, unit: "seconds", scope: "CAMPAIGN", sourceUrl: caseUrl }],
    techniques: [{ dimension: "STORY", description: "Brand-led original puppet world", basis: "SOURCE_REPORTED" }],
  }],
};

const request = {
  requestId: "creative-test-001",
  tenantId: "smile-ai-group-test",
  objective: "Build an original local-life short informed by successful external formats",
  targetPlatforms: ["tiktok"],
  requireExternalSuccessResearch: true,
};
const analysis = {
  platform: "tiktok",
  analyzedAt: "2026-11-11T09:00:00Z",
  audienceFit: "Korean local-life enthusiasts",
  storyStrategy: "Original field-based human interest story",
  externalCaseRefs: ["TIKTOK_BVG_OFFICIAL_CAMPAIGN"],
  originalityStrategy: "Use new independently shot Busan scenes and original Korean script; never reuse BVG visuals",
};
const plan = {
  platform: "tiktok",
  hook: "An original question from real Busan footage",
  script: "Original script",
  storyBeats: [{ order: 1, role: "HOOK" }],
  creativeDecisions: { title: { enabled: false }, subtitle: { required: false }, voice: { required: false }, music: { required: false } },
  goldenBindings: [
    { decisionArea: "STORY", moduleId: "STORY", moduleVersion: "1.0.0", baselineId: "LOCAL_STORY" },
    { decisionArea: "VISUAL_LAYOUT", moduleId: "LAYOUT", moduleVersion: "1.0.0", baselineId: "LOCAL_LAYOUT" },
    { decisionArea: "QC", moduleId: "QC", moduleVersion: "1.0.0", baselineId: "LOCAL_QC" },
  ],
};

const run = (requestOverride = request, analysisOverride = analysis, bundleOverride = externalSuccessBundle) =>
  createCreativeExecutionSpec({
    request: requestOverride,
    platformAnalyses: [analysisOverride],
    storyPlans: [plan],
    externalSuccessBundle: bundleOverride,
  });

const out = run();
assert.equal(out.externalSuccess.status, "RESEARCH_ONLY_NOT_GOLDEN");
assert.equal(out.externalSuccess.cases[0].distribution, "MIXED");
assert.equal(out.platformStories[0].externalBenchmark.evidenceRole, "INSPIRATION_NOT_PRODUCTION_APPROVAL");
assert.equal(out.locked, true);
assert.throws(() => run(request, analysis, null), /External success evidence is required/);
assert.throws(() => run(request, { ...analysis, externalCaseRefs: ["UNKNOWN"] }), /unverified or cross-platform/);
assert.throws(() => run(request, { ...analysis, originalityStrategy: undefined }), /originalityStrategy/);

const legacy = run({ ...request, requireExternalSuccessResearch: false }, { ...analysis, externalCaseRefs: [] }, null);
assert.equal(legacy.externalSuccess, null);
assert.equal(legacy.platformStories[0].externalBenchmark, null);
console.log("PASS: Creative Director external-success research gate and legacy compatibility");
