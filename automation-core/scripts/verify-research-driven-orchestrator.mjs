import assert from "node:assert/strict";
import { createResearchDrivenCreativePlan } from "../src/ResearchDrivenCreativeOrchestrator.mjs";

const reviewedAt = "2026-11-11T08:00:00Z";
const caseFor = (platform) => ({
  id: `${platform}-reference-01`,
  platform,
  country: "KR",
  sourceUrl: `https://www.example.org/${platform}/verified-video`,
  observedAt: "2026-11-11T07:00:00Z",
  verified: true,
  distribution: "ORGANIC",
  visualReviewStatus: "FRAMES_REVIEWED",
  contentClass: "EDUCATIONAL_STORY",
  frameAudit: [{
    dimension: "HOOK",
    visualObservation: "A human opens an ordinary question before the reveal (synthetic integration-test fixture).",
    sourceVideoUrl: `https://www.example.org/${platform}/verified-video`,
    reviewerId: "synthetic-test-reviewer",
    reviewMethod: "MANUAL_VIDEO_REVIEW",
    reviewedAt: "2026-11-11T07:50:00Z",
    timeSec: 1.2,
  }],
  metrics: [{
    name: "viewCount",
    value: 100000,
    unit: "views",
    scope: "SINGLE_VIDEO",
    sourceUrl: `https://www.example.org/${platform}/verified-video`,
  }],
  techniques: [{ dimension: "HOOK", description: "Human question shown in the first second", basis: "FRAME_OBSERVED" }],
});

const brandVisualPolicy = {
  sourceRef: "smile-ai-group/smile-ai-group:config/group-brand-design.json@automation/smile-ai-group-guardrails",
  palette: {
    gold: "#FFC86B", purple: "#A855F7", aiBlue: "#00D1FF", futureCyan: "#00E5FF", deepNavy: "#071425", onDark: "#F7FAFF",
  },
  approvedFontRoles: ["VERIFIED_SOCIAL_DISPLAY"],
  verifiedBoxModes: ["AUTO_WIDTH", "NO_BOX"],
  verifiedWidthModes: ["MEASURED_TEXT_AUTO_WIDTH"],
  verifiedSizeStrategies: ["READABLE_AUTO_SIZE"],
};

const idea = (platform, id, score) => ({
  id, platform, tone: "INFORMATIONAL", hook: `What actually happened in ${platform}?`,
  premise: "Local on-the-ground testimony becomes a human-interest story without copying source frames.",
  sourceStrategy: "Original footage and human question, outside-case structure only as an inspiration.",
  emotionalTarget: "CURIOSITY",
  storyBeats: ["Question", "Verified context", "Open conclusion"],
  evidenceRefs: [`${platform}-reference-01`],
  freshnessScore: score, firstImpactScore: score, audienceFitScore: score,
  platformFitScore: score, feasibilityScore: score, truthSafetyScore: score,
  repetitionRiskScore: 0.08,
});

const title = (platform, id, text, score) => ({
  id, platform, text, angle: "LOCAL_QUESTION",
  evidenceRefs: [`${platform}-reference-01`],
  noveltyScore: score, firstImpactScore: score, clarityScore: score,
  relevanceScore: score, platformFitScore: score, truthSafetyScore: score,
  curiosityScore: score, repetitionRiskScore: 0.05, clickbaitRiskScore: 0.06,
});

const treatment = (platform, id, colorToken, score) => ({
  id, platform, fontRole: "VERIFIED_SOCIAL_DISPLAY", colorToken, backgroundToken: "deepNavy",
  boxMode: "AUTO_WIDTH", widthMode: "MEASURED_TEXT_AUTO_WIDTH", sizeStrategy: "READABLE_AUTO_SIZE",
  creativeRationale: "Readable restrained original human-question frame, subject to actual-frame QA.",
  noveltyScore: score, platformFitScore: score, firstImpactScore: score,
  legibilityScore: score, repetitionRiskScore: 0.08,
});

const goldenBindings = ["STORY", "VISUAL_LAYOUT", "QC"].map((decisionArea) => ({
  decisionArea, moduleId: `GOLDEN_${decisionArea}`,
  moduleVersion: "test-reference-version", baselineId: "test-reference-baseline",
}));

const inputFor = (platform, titleRequired) => ({
  platform,
  analysis: {
    analyzedAt: reviewedAt,
    audienceFit: "Local-language people interested in an authentic human-interest story",
    storyStrategy: "Platform-specific original scene order and a cautious question",
    externalCaseRefs: [`${platform}-reference-01`],
    originalityStrategy: "Use narrative mechanics as a reference, but no copied media or wording",
  },
  ideaCandidates: [idea(platform, `${platform}-original-01`, 0.95), idea(platform, `${platform}-alternative-02`, 0.76)],
  titleRequired,
  titleCandidates: titleRequired ? [
    title(platform, `${platform}-title-01`, "이 장면, 어떻게 보이세요?", 0.94),
    title(platform, `${platform}-title-02`, "이런 순간을 보셨나요?", 0.78),
  ] : [],
  visualCandidates: titleRequired ? [
    treatment(platform, `${platform}-gold-01`, "gold", 0.95),
    treatment(platform, `${platform}-cyan-02`, "futureCyan", 0.80),
  ] : [],
  scriptsByIdeaId: {
    [`${platform}-original-01`]: "An original script describing our own recorded human-interest moment and the question it raises.",
  },
  goldenBindings,
});

const request = {
  requestId: "synthetic-integration-test-001",
  tenantId: "synthetic-test-tenant",
  objective: "Produce independent original stories for the two requested platforms",
  targetPlatforms: ["tiktok", "instagram"],
  country: "KR",
  language: "ko",
};
const externalSuccessBundle = { reviewedAt, cases: [caseFor("tiktok"), caseFor("instagram")] };
const platformInputs = [inputFor("tiktok", true), inputFor("instagram", false)];
const args = { request, externalSuccessBundle, platformInputs, brandVisualPolicy };

const result = createResearchDrivenCreativePlan(args);
assert.equal(result.status, "ORIGINAL_PLANS_PREPARED_NOT_RENDERED");
assert.equal(result.productionPermission, false);
assert.equal(result.publicationPermission, false);
assert.deepEqual(result.creativeExecutionSpec.targetPlatforms, ["tiktok", "instagram"]);
assert.equal(result.creativeExecutionSpec.platformStories.length, 2);
assert.equal(result.creativeExecutionSpec.platformStories[0].creativeDecisions.title.enabled, true);
assert.equal(result.creativeExecutionSpec.platformStories[0].creativeDecisions.title.colorStrategy, "gold");
assert.equal(result.creativeExecutionSpec.platformStories[1].creativeDecisions.title.enabled, false);
assert.equal(result.selections[1].selectedTreatment, null);
assert.equal(result.selections[0].firstImpact.platform, "tiktok");
assert.equal(result.creativeExecutionSpec.platformStories[0].externalBenchmark.evidenceRole, "INSPIRATION_NOT_PRODUCTION_APPROVAL");

function fails(changes, pattern) {
  assert.throws(() => createResearchDrivenCreativePlan({ ...args, ...changes }), pattern);
}

fails({ externalSuccessBundle: null }, /External success evidence is required/);
fails({ externalSuccessBundle: {
  reviewedAt,
  cases: [caseFor("tiktok"), { ...caseFor("instagram"), visualReviewStatus: "CASE_DESCRIPTION_ONLY", frameAudit: [], techniques: [
    { dimension: "HOOK", description: "Only reported", basis: "SOURCE_REPORTED" },
  ] }],
} }, /Missing directly reviewed external video for requested platform: instagram/);
fails({ platformInputs: [platformInputs[0]] }, /Missing platform creative input: instagram/);
fails({ platformInputs: [platformInputs[0], { ...platformInputs[1], platform: "facebook" }] }, /Unrequested platform creative input: facebook/);
fails({ platformInputs: [
  { ...platformInputs[0], analysis: { ...platformInputs[0].analysis, externalCaseRefs: ["instagram-reference-01"] } },
  platformInputs[1],
] }, /missing or wrong-platform case/);
fails({ platformInputs: [
  { ...platformInputs[0], visualCandidates: [
    { ...platformInputs[0].visualCandidates[0], colorToken: "misoPink" },
    platformInputs[0].visualCandidates[1],
  ] }, platformInputs[1],
] }, /outside the canonical group palette/);
fails({ platformInputs: [
  { ...platformInputs[0], ideaCandidates: [
    { ...platformInputs[0].ideaCandidates[0], evidenceRefs: ["unverified"] },
    platformInputs[0].ideaCandidates[1],
  ] }, platformInputs[1],
] }, /selected idea must trace/);
fails({ platformInputs: [
  { ...platformInputs[0], titleCandidates: [
    { ...platformInputs[0].titleCandidates[0], evidenceRefs: ["unverified"] },
    platformInputs[0].titleCandidates[1],
  ] }, platformInputs[1],
] }, /selected title must trace/);

console.log("PASS: outside-video-first evidence, independent SNS briefs, optional title, canonical palette, no production/publishing");
