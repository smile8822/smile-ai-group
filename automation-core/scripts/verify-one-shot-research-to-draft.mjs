import assert from "node:assert/strict";
import { createOneShotResearchToDraft } from "../src/OneShotResearchToDraft.mjs";

// Synthetic only. No verified public videos, real account authentication, or model API calls.
const checkedAt = "2026-11-11T08:00:00Z";
const caseFor = (platform) => ({
  id: `${platform}-synthetic-source`, platform, country: "KR",
  sourceUrl: `https://www.example.org/${platform}/source`,
  observedAt: "2026-11-11T07:00:00Z", verified: true,
  distribution: "ORGANIC", contentClass: "LOCAL_STORY",
  visualReviewStatus: "FRAMES_REVIEWED",
  frameAudit: [{
    dimension: "HOOK", visualObservation: "A direct human reaction at 1.1s (synthetic fixture only)",
    sourceVideoUrl: `https://www.example.org/${platform}/source`,
    reviewerId: "fixture-frame-reviewer", reviewMethod: "MANUAL_VIDEO_REVIEW",
    reviewedAt: "2026-11-11T07:45:00Z", timeSec: 1.1,
  }],
  metrics: [{ name: "views", value: 120000, unit: "views", scope: "SINGLE_VIDEO",
    sourceUrl: `https://www.example.org/${platform}/source` }],
  techniques: [{ dimension: "HOOK", description: "An authentic reaction before explanation", basis: "FRAME_OBSERVED" }],
});
const externalSuccessBundle = { reviewedAt: checkedAt, cases: [caseFor("tiktok"), caseFor("instagram")] };
const request = { requestId: "synthetic-one-shot", tenantId: "synthetic-tenant", objective: "Original Bucangi documentary",
  targetPlatforms: ["tiktok", "instagram"], country: "KR", language: "ko" };
const targets = [
  { id: "tt-ko", platform: "tiktok", language: "ko", channelKey: "ONE_TIKTOK_ACCOUNT" },
  { id: "tt-id", platform: "tiktok", language: "id", channelKey: "ONE_TIKTOK_ACCOUNT" },
  { id: "ig-ko", platform: "instagram", language: "ko", channelKey: "IG_ACCOUNT" },
];
const brandVisualPolicy = {
  sourceRef: "smile-ai-group/smile-ai-group:config/group-brand-design.json@automation/smile-ai-group-guardrails",
  palette: { deepNavy: "#071425", gold: "#FFC86B", purple: "#A855F7",
    aiBlue: "#00D1FF", futureCyan: "#00E5FF", onDark: "#F7FAFF" },
  approvedFontRoles: ["TEST_ONLY_FONT_ROLE"],
  verifiedBoxModes: ["AUTO_WIDTH"],
  verifiedWidthModes: ["MEASURED_TEXT_AUTO_WIDTH"],
  verifiedSizeStrategies: ["READABLE_AUTO_SIZE"],
};
const score = (keys, high = 0.98) => Object.fromEntries(keys.map((key) => [key, key.includes("Risk") ? 0.02 : high]));
const ideaKeys = ["freshnessScore", "firstImpactScore", "audienceFitScore", "platformFitScore", "feasibilityScore", "truthSafetyScore", "repetitionRiskScore"];
const titleKeys = ["noveltyScore", "firstImpactScore", "clarityScore", "relevanceScore", "platformFitScore", "truthSafetyScore", "curiosityScore", "repetitionRiskScore", "clickbaitRiskScore"];
const visualKeys = ["noveltyScore", "platformFitScore", "firstImpactScore", "legibilityScore", "repetitionRiskScore"];
const goldenBindingsByPlatform = Object.fromEntries(["tiktok", "instagram"].map((platform) => [platform,
  ["STORY", "VISUAL_LAYOUT", "QC"].map((decisionArea) => ({
    decisionArea, moduleId: `fixture-${platform}-${decisionArea}`, moduleVersion: "test", baselineId: "test",
  })),
]));

const generated = (platform) => {
  const caseRef = `${platform}-synthetic-source`;
  const idea = (id) => ({ id, platform, tone: "INFORMATIONAL",
    hook: "현장에서 본 그 순간, 여러분의 생각은?", premise: "부캉이 현장 관찰 기록",
    sourceStrategy: "Original local imagery and careful inference, not copied source video",
    emotionalTarget: "CURIOSITY", storyBeats: ["물음", "현장 기록", "시청자 의견"],
    evidenceRefs: [caseRef], ...score(ideaKeys, 0.01) });
  const title = (id, text) => ({ id, text, platform, angle: "OPEN_QUESTION",
    evidenceRefs: [caseRef], ...score(titleKeys, 0.01) });
  const visual = (id, colorToken) => ({ id, platform, fontRole: "TEST_ONLY_FONT_ROLE",
    colorToken, backgroundToken: "deepNavy", boxMode: "AUTO_WIDTH",
    widthMode: "MEASURED_TEXT_AUTO_WIDTH", sizeStrategy: "READABLE_AUTO_SIZE",
    creativeRationale: "Restrained original story title readable on dark ground",
    ...score(visualKeys, 0.01) });
  return {
    platform, generatorId: "GENERATOR_A",
    analysis: { audienceFit: "People interested in verified Busan local news",
      storyStrategy: "An open question about genuine recorded events",
      originalityStrategy: "Develop a different human story and original footage" },
    ideaCandidates: [idea(`${platform}-idea-1`), idea(`${platform}-idea-2`)],
    titleRequired: platform === "tiktok",
    titleCandidates: platform === "tiktok"
      ? [title("tt-title-1", "부캉이를 보고 어떤 생각이 드세요?"), title("tt-title-2", "이 움직임, 무엇을 뜻할까요?")] : [],
    visualCandidates: platform === "tiktok"
      ? [visual("tt-gold", "gold"), visual("tt-cyan", "futureCyan")] : [],
    scriptsByIdeaId: {
      [`${platform}-idea-1`]: "현장에서 관찰한 내용을 사실과 질문으로 구분해 전달합니다.",
      [`${platform}-idea-2`]: "서로 다른 관찰을 설명하고 단정 없이 시청자에게 묻습니다.",
    },
    goldenBindings: [{ decisionArea: "STORY", moduleId: "GENERATED_FAKE" }],
  };
};
const generator = { async propose({ platform }) { return generated(platform); } };
const evaluator = { async review({ platform }) {
  const ids = [ `${platform}-idea-1`, `${platform}-idea-2` ];
  return {
    status: "REVIEWED", reviewerId: "INDEPENDENT_REVIEWER_B", generationSourceId: "GENERATOR_A",
    ideaScores: Object.fromEntries(ids.map((id) => [id, score(ideaKeys)])),
    titleScores: { "tt-title-1": score(titleKeys), "tt-title-2": score(titleKeys, 0.90) },
    visualScores: { "tt-gold": score(visualKeys), "tt-cyan": score(visualKeys, 0.9) },
  };
} };
const localization = { async compose({ target }) {
  const lang = target.language;
  return {
    targetId: target.id,
    metadataTitle: lang === "id" ? "Mengamati Bucangi dari dekat" :
      target.platform === "tiktok" ? "부캉이 현장에서 발견한 장면" : "부캉이의 움직임을 직접 살펴봤습니다",
    bodyText: lang === "id" ? "Apa pendapatmu tentang gerakan hiu ini?" :
      target.platform === "tiktok" ? "현장에서 관찰한 내용을 함께 살펴보세요. 여러분 생각은 어떤가요?" :
        "직접 관찰한 장면을 사실과 추측으로 나눠 소개합니다. 여러분 의견을 알려주세요.",
    hashtags: lang === "id"
      ? { topic: ["#Bucangi"], region: ["#Busan"], trend: [], brand: [] }
      : { topic: ["#부캉이"], region: ["#부산"], trend: [], brand: [] },
  };
} };
const accountSettingsByTarget = Object.fromEntries(["tt-ko", "tt-id"].map((id) => [id, {
  creatorPrivacyOptions: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"],
  creatorInfoVerified: true, privacyChoice: "SELF_ONLY",
}]));
const args = {
  request, targets, checkedAt, externalSuccessBundle, brandVisualPolicy,
  goldenBindingsByPlatform, generator, evaluator, localization, accountSettingsByTarget,
};
const result = await createOneShotResearchToDraft(args);
assert.equal(result.status, "ONE_SHOT_AI_CREATIVE_AND_METADATA_DRAFTS_READY_NOT_PUBLISHED");
assert.equal(result.productionPermission, false);
assert.equal(result.publicationPermission, false);
assert.equal(result.creativePlan.creativeExecutionSpec.platformStories.length, 2);
assert.equal(result.publicationDrafts.draftCount, 3);
assert.equal(result.publicationDrafts.drafts[0].channelKey, result.publicationDrafts.drafts[1].channelKey);
assert.deepEqual(result.publicationDrafts.drafts[0].orderedHashtags, ["#부캉이", "#부산"]);
assert.equal(result.creativePlan.selections[0].originalIdea.freshnessScore, 0.98); // model's fraudulent 0.01 ignored
assert.ok(result.creativePlan.creativeExecutionSpec.platformStories[0].goldenBindings.every((b) => b.moduleId !== "GENERATED_FAKE"));
let trustedResearchCalls = 0;
const providerDriven = await createOneShotResearchToDraft({ ...args, externalSuccessBundle: null,
  researchProvider: { async collectReviewedEvidence({ requestedPlatforms }) {
    trustedResearchCalls++;
    assert.deepEqual(requestedPlatforms, ["tiktok", "instagram"]);
    return externalSuccessBundle;
  } },
});
assert.equal(trustedResearchCalls, 1);
assert.equal(providerDriven.publicationPermission, false);

async function rejects(changes, pattern) {
  await assert.rejects(() => createOneShotResearchToDraft({ ...args, ...changes }), pattern);
}
let calls = 0;
await rejects({ externalSuccessBundle: null, generator: { async propose() { calls++; return null; } } }, /External success evidence is required/);
assert.equal(calls, 0);
await rejects({ generator: { async propose({ platform }) {
  const output = generated(platform);
  output.ideaCandidates[0].evidenceRefs = ["fabricated-source"];
  return output;
} } }, /must cite only actually validated/);
await rejects({ evaluator: { async review({ platform }) {
  return { ...await evaluator.review({ platform }), reviewerId: "GENERATOR_A" };
} } }, /independent creative reviewer/);
await rejects({ localization: { async compose({ target }) {
  return { ...await localization.compose({ target }), brandRelevance: { scriptReviewVerified: true } };
} } }, /cannot self-certify/);
await rejects({ localization: { async compose({ target }) {
  const data = await localization.compose({ target });
  if (target.id === "tt-ko") data.hashtags.brand = ["#SMILEAIGROUP"];
  return data;
} } }, /content-relevant company brand evidence/);
await rejects({ localization: { async compose({ target }) {
  const data = await localization.compose({ target });
  if (target.id === "tt-ko") data.hashtags.trend = [{ tag: "#유행", verified: true, sourceUrl: "https://fake.test", observedAt: checkedAt }];
  return data;
} } }, /unsupported or unverified trend hashtag/);
await rejects({ accountSettingsByTarget: {} }, /privacyChoice is required/);
console.log("PASS: externally validated research precedes generation, independent scores override model, two SNS + shared TikTok, no company tags on unrelated story, no publishing");
