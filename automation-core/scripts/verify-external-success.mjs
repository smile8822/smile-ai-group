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

const auditedCase = {
  ...input.cases[0],
  visualReviewStatus: "FRAMES_REVIEWED",
  frameAudit: [{
    dimension: "HOOK",
    sourceVideoUrl: "https://www.tiktok.com/@creator/video/1234567890000000000",
    visualObservation: "An original gesture appears within the opening 1.5 seconds",
    timeSec: 1.5,
    reviewerId: "human-editor-001",
    reviewMethod: "MANUAL_VIDEO_REVIEW",
    reviewedAt: "2026-11-11T08:59:00Z",
  }],
  techniques: [{ dimension: "HOOK", description: "Opening gesture", basis: "FRAME_OBSERVED" }],
};
const audited = validateExternalSuccessBundle({ ...request, bundle: { ...input, cases: [auditedCase] }, required: true });
assert.equal(audited.cases[0].frameAudit[0].rightsToReuseMedia, false);
assert.equal(validateExternalSuccessBundle({ ...request, bundle: { ...input, cases: [auditedCase] }, required: true, requireDirectVideoReview: true }).cases.length, 1);
assert.throws(() => validateExternalSuccessBundle({ ...request, bundle: input, required: true, requireDirectVideoReview: true }), /Missing directly reviewed external video/);
assert.throws(() => validateExternalSuccessBundle({ ...request, bundle: input, required: false, requireDirectVideoReview: true }), /requires the external success research gate/);
assert.throws(() => validateExternalSuccessBundle({ ...request, bundle: { ...input, cases: [{ ...auditedCase, frameAudit: [] }] }, required: true }), /without timestamped frameAudit/);
assert.throws(() => validateExternalSuccessBundle({ ...request, bundle: { ...input, cases: [{ ...auditedCase, techniques: [{ dimension: "FONT", description: "Unreviewed font", basis: "FRAME_OBSERVED" }] }] }, required: true }), /lacks a matching reviewed frame timestamp/);
assert.throws(() => validateExternalSuccessBundle({ ...request, bundle: { ...input, cases: [{ ...auditedCase, frameAudit: [{ ...auditedCase.frameAudit[0], reviewedAt: "2026-11-12T08:59:00Z" }] }] }, required: true }), /reviewed after the bundle/);
console.log("PASS: external success evidence validation, platform scope, provenance, organic/paid, creative originality, backward compatibility");
