import assert from "node:assert/strict";

import {
  clearSuccessBaselineRegistryForTests,
  listSuccessBaselines,
  promoteSuccessBaseline,
  registerSuccessBaseline,
  resolveCurrentSuccessBaseline,
  SUCCESS_BASELINE_STATUS,
} from "../src/SuccessBaselineRegistry.mjs";
import {
  createCreativeExecutionSpec,
  requestNeedsFreshContext,
} from "../src/CreativeDirector.mjs";

clearSuccessBaselineRegistryForTests();

assert.equal(requestNeedsFreshContext({ latestNews: true }), true);
assert.equal(requestNeedsFreshContext({ latestInformation: true }), true);
assert.equal(requestNeedsFreshContext({}), false);

const scope = {
  serviceScope: "CUSTOMER_AI_AUTOMATION",
  outputKind: "SOCIAL_SHORT",
  contentClass: "LOCAL_NEWS_STORY",
  capability: "VISUAL_LAYOUT",
  platform: "tiktok",
  language: "id",
  country: "ID",
};

const v1 = registerSuccessBaseline({
  id: "LOCAL_NEWS_TIKTOK_ID_LAYOUT_V1",
  version: "1.0.0",
  verified: true,
  qcPassed: true,
  realUseSuccess: true,
  verifiedAt: "2026-10-01T10:00:00Z",
  qualityScore: 0.91,
  scope,
  evidenceRefs: ["evidence:v1"],
  methodRefs: ["module:layout-v1"],
});
assert.equal(v1.status, SUCCESS_BASELINE_STATUS.ACTIVE);

assert.throws(
  () =>
    registerSuccessBaseline({
      id: "FAILED_LAYOUT",
      version: "1.0.0",
      verified: false,
      qcPassed: false,
      realUseSuccess: false,
      verifiedAt: "2026-10-02T10:00:00Z",
      qualityScore: 0.99,
      scope,
    }),
  /verified \+ QC-passed \+ real-use success/,
);

assert.throws(
  () =>
    promoteSuccessBaseline({
      id: "REGRESSION_LAYOUT",
      version: "1.1.0",
      verified: true,
      qcPassed: true,
      realUseSuccess: true,
      verifiedAt: "2026-10-02T10:00:00Z",
      qualityScore: 0.88,
      scope,
      evidenceRefs: ["evidence:regression"],
    }),
  /below current success baseline/,
);

const v2 = promoteSuccessBaseline({
  id: "LOCAL_NEWS_TIKTOK_ID_LAYOUT_V2",
  version: "2.0.0",
  verified: true,
  qcPassed: true,
  realUseSuccess: true,
  verifiedAt: "2026-10-05T08:00:00Z",
  qualityScore: 0.96,
  scope,
  evidenceRefs: ["evidence:v2"],
  methodRefs: ["module:layout-v2"],
});
assert.equal(v2.status, SUCCESS_BASELINE_STATUS.ACTIVE);

const current = resolveCurrentSuccessBaseline(scope);
assert.equal(current.id, "LOCAL_NEWS_TIKTOK_ID_LAYOUT_V2");
assert.equal(
  listSuccessBaselines().find((item) => item.id === v1.id).status,
  SUCCESS_BASELINE_STATUS.SUPERSEDED,
);

for (const [capability, baselineId] of [
  ["STORY", "STORY_ID_TIKTOK_V1"],
  ["SUBTITLE", "SUBTITLE_ID_TIKTOK_V1"],
  ["VOICE", "VOICE_ID_TIKTOK_V1"],
  ["MUSIC", "MUSIC_ID_TIKTOK_V1"],
  ["QC", "QC_SOCIAL_V1"],
]) {
  registerSuccessBaseline({
    id: baselineId,
    version: "1.0.0",
    verified: true,
    qcPassed: true,
    realUseSuccess: true,
    verifiedAt: "2026-10-05T08:00:00Z",
    qualityScore: 0.95,
    scope: { ...scope, capability },
    evidenceRefs: [`evidence:${capability.toLowerCase()}`],
  });
}

const spec = createCreativeExecutionSpec({
  request: {
    requestId: "request-creative-001",
    tenantId: "customer-001",
    serviceScope: "CUSTOMER_AI_AUTOMATION",
    objective: "Create an Indonesian TikTok story from the latest verified local news.",
    audience: "Indonesian travelers",
    country: "ID",
    language: "id",
    targetPlatforms: ["tiktok"],
    latestNews: true,
    latestInformation: true,
    trendSensitive: true,
    maxEvidenceAgeMinutes: 180,
  },
  researchBundle: {
    checkedAt: "2026-10-05T09:00:00Z",
    items: [
      {
        claim: "Verified current local development used by the story.",
        sourceRef: "source:news-001",
        observedAt: "2026-10-05T08:30:00Z",
        verified: true,
        category: "NEWS",
        locale: "ko-KR",
      },
    ],
  },
  platformAnalyses: [
    {
      platform: "tiktok",
      analyzedAt: "2026-10-05T08:45:00Z",
      audienceFit: "Fast hook, visual-first, concise context for Indonesian travelers.",
      storyStrategy: "Lead with the verified current event, then explain why it matters to the audience.",
      trendSignals: [{ id: "signal-001", source: "platform-analysis" }],
      recommendedDurationSec: 24,
    },
  ],
  storyPlans: [
    {
      platform: "tiktok",
      hook: "Start with the current verified event and immediate visual proof.",
      script: "A platform-specific Indonesian script generated from verified current facts.",
      storyBeats: [
        { order: 1, role: "HOOK" },
        { order: 2, role: "CONTEXT" },
        { order: 3, role: "VALUE" },
        { order: 4, role: "CTA" },
      ],
      evidenceRefs: ["source:news-001"],
      creativeDecisions: {
        title: {
          enabled: true,
          fontRole: "CURRENT_VERIFIED_SOCIAL_DISPLAY",
          colorStrategy: "CURRENT_SUCCESS_BASELINE_ACCENT",
          boxMode: "AUTO_DECIDE_FROM_VISUAL_DENSITY",
          widthMode: "MEASURED_TEXT_AUTO_WIDTH",
        },
        subtitle: {
          required: true,
          language: "id",
          timingMode: "NATIVE_AUDIO_TIMING",
          highlightMode: "PROGRESSIVE_ACTIVE_WORD_OR_PHRASE",
        },
        voice: {
          required: true,
          assetPolicy: "CUSTOMER_ALLOWED_ONLY",
        },
        music: {
          required: true,
          role: "LOW_LEVEL_SUPPORT_WITH_SPEECH_DUCKING",
        },
      },
      goldenBindings: [
        { decisionArea: "STORY", moduleId: "STORY_PLAN_V2", moduleVersion: "2.0.0", baselineId: "STORY_ID_TIKTOK_V1" },
        { decisionArea: "VISUAL_LAYOUT", moduleId: "LAYOUT_V2", moduleVersion: "2.0.0", baselineId: "LOCAL_NEWS_TIKTOK_ID_LAYOUT_V2" },
        { decisionArea: "SUBTITLE", moduleId: "SUBTITLE_V2", moduleVersion: "2.0.0", baselineId: "SUBTITLE_ID_TIKTOK_V1" },
        { decisionArea: "VOICE", moduleId: "VOICE_BIND_V2", moduleVersion: "2.0.0", baselineId: "VOICE_ID_TIKTOK_V1" },
        { decisionArea: "MUSIC", moduleId: "MUSIC_SELECT_V1", moduleVersion: "1.0.0", baselineId: "MUSIC_ID_TIKTOK_V1" },
        { decisionArea: "QC", moduleId: "QC_V2", moduleVersion: "2.0.0", baselineId: "QC_SOCIAL_V1" },
      ],
    },
  ],
});

assert.equal(spec.owner, "SMILE_AI_GROUP");
assert.equal(spec.locked, true);
assert.equal(spec.research.items.length, 1);
assert.equal(spec.platformStories[0].creativeDecisions.subtitle.required, true);
assert.equal(spec.platformStories[0].creativeDecisions.voice.assetPolicy, "CUSTOMER_ALLOWED_ONLY");

assert.throws(
  () =>
    createCreativeExecutionSpec({
      request: {
        requestId: "stale",
        tenantId: "customer-001",
        objective: "Latest-news video",
        targetPlatforms: ["tiktok"],
        latestNews: true,
        maxEvidenceAgeMinutes: 60,
      },
      researchBundle: {
        checkedAt: "2026-10-05T09:00:00Z",
        items: [{
          claim: "Stale claim",
          sourceRef: "source:old",
          observedAt: "2026-10-05T06:00:00Z",
          verified: true,
        }],
      },
      platformAnalyses: [],
      storyPlans: [],
    }),
  /stale for this request/,
);

console.log(JSON.stringify({
  status: "PASS",
  owner: "SMILE_AI_GROUP",
  latestVerifiedBaseline: current.id,
  latestVerifiedBaselineQuality: current.qualityScore,
  creativeDirectorLocked: spec.locked,
  platformStories: spec.platformStories.length,
  freshResearchItems: spec.research.items.length,
}, null, 2));
