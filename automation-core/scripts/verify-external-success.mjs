import assert from "node:assert/strict";
import { validateExternalSuccessBundle, validateCreativeBenchmarkDecision } from "../src/ExternalSuccessEvidence.mjs";

const input = {
  reviewedAt: "2026-11-11T09:00:00Z",
  cases: [{
    id: "BVG_CASE",
    platform: "tiktok",
    country: "DE",
    sourceUrl: "https://ads.tiktok.com/business/en-US/inspiration/bvg-x-gud-berlin-tiktok-success-stories",
    observedAt: "2026-11-11T08:50:00Z",
    verified: true,
    distribution: "MIXED",
    visualReviewStatus: "CASE_DESCRIPTION_ONLY",
    contentClass: "PUBLIC_SERVICE_HUMOR",
    metrics: [{ name: "average_play_time", value: 25.08, unit: "seconds", scope: "CAMPAIGN", sourceUrl: "https://ads.tiktok.com/business/en-US/inspiration/bvg-x-gud-berlin-tiktok-success-stories" }],
    techniques: [{ dimension: "STORY", description: "Original handmade puppet universe", basis: "SOURCE_REPORTED" }],
  }],
};
const request = { targetPlatforms: ["tiktok"] };
const bundle = validateExternalSuccessBundle({ ...request, bundle: input, required: true });
assert.equal(bundle.cases[0].goldenProductionMethod, false);
assert.equal(bundle.cases[0].metrics[0].scope, "CAMPAIGN");
assert.equal(validateCreativeBenchmarkDecision({ platform: "tiktok", analysis: { externalCaseRefs: ["BVG_CASE"], originalityStrategy: "Original Busan field observation, not the puppet scenes" }, bundle, required: true }).externalCaseRefs[0], "BVG_CASE");
assert.throws(() => validateExternalSuccessBundle({ targetPlatforms: ["tiktok", "youtube"], bundle: input, required: true }), /Missing external success research/);
assert.throws(() => validateExternalSuccessBundle({ ...request, bundle: { ...input, cases: [{ ...input.cases[0], verified: false }] }, required: true }), /verified evidence/);
assert.throws(() => validateExternalSuccessBundle({ ...request, bundle: { ...input, cases: [{ ...input.cases[0], techniques: [{ dimension: "TYPOGRAPHY", description: "Unseen font", basis: "FRAME_OBSERVED" }] }] }, required: true }), /cannot claim frame observation/);
assert.throws(() => validateExternalSuccessBundle({ ...request, bundle: { ...input, cases: [{ ...input.cases[0], distribution: "ORGANIC", metrics: [] }] }, required: true }), /verified performance metric/);
assert.throws(() => validateCreativeBenchmarkDecision({ platform: "youtube", analysis: { externalCaseRefs: ["BVG_CASE"], originalityStrategy: "Original" }, bundle, required: true }), /cross-platform/);
assert.throws(() => validateCreativeBenchmarkDecision({ platform: "tiktok", analysis: { externalCaseRefs: ["BVG_CASE"] }, bundle, required: true }), /originalityStrategy/);
assert.equal(validateExternalSuccessBundle({ ...request, bundle: undefined, required: false }), null);
console.log("PASS: external success evidence validation, platform scope, provenance, organic/paid, creative originality, backward compatibility");
