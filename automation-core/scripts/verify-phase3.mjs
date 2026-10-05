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
import {
  buildFirstImpactDecision,
  scoreCreativeIdea,
  scoreCreativeTitle,
  selectCreativeIdea,
  selectCreativeTitle,
} from "../src/CreativeIdeationEngine.mjs";

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
assert.equal(spec.platformScopePolicy.requestedPlatformsOnly, true);
assert.equal(spec.platformScopePolicy.autoExpandPlatforms, false);

// A YouTube-only request must create only YouTube work.
const youtubeOnly = createCreativeExecutionSpec({
  request: {
    requestId: "request-youtube-only",
    tenantId: "customer-002",
    objective: "Create only a YouTube video.",
    targetPlatforms: ["youtube"],
  },
  platformAnalyses: [{
    platform: "youtube",
    analyzedAt: "2026-10-05T09:00:00Z",
    audienceFit: "Search and watch intent.",
    storyStrategy: "YouTube-specific story.",
  }],
  storyPlans: [{
    platform: "youtube",
    hook: "YouTube hook",
    script: "YouTube-only script.",
    storyBeats: [{ order: 1, role: "HOOK" }],
    creativeDecisions: {
      title: { enabled: true, fontRole: "VERIFIED", colorStrategy: "VERIFIED", boxMode: "VERIFIED", widthMode: "VERIFIED" },
      subtitle: { required: false },
      voice: { required: false },
      music: { required: false },
    },
    goldenBindings: [
      { decisionArea: "STORY", moduleId: "STORY_YT", moduleVersion: "1.0.0", baselineId: "STORY_YT_BASE" },
      { decisionArea: "VISUAL_LAYOUT", moduleId: "LAYOUT_YT", moduleVersion: "1.0.0", baselineId: "LAYOUT_YT_BASE" },
      { decisionArea: "QC", moduleId: "QC_YT", moduleVersion: "1.0.0", baselineId: "QC_YT_BASE" },
    ],
  }],
});
assert.deepEqual(youtubeOnly.targetPlatforms, ["youtube"]);
assert.deepEqual(youtubeOnly.platformStories.map((item) => item.platform), ["youtube"]);

// A TikTok-only request must reject accidental Instagram work.
assert.throws(
  () =>
    createCreativeExecutionSpec({
      request: {
        requestId: "request-tiktok-only",
        tenantId: "customer-003",
        objective: "Create only TikTok.",
        targetPlatforms: ["tiktok"],
      },
      platformAnalyses: [
        {
          platform: "tiktok",
          analyzedAt: "2026-10-05T09:00:00Z",
          audienceFit: "TikTok audience.",
          storyStrategy: "TikTok story.",
        },
        {
          platform: "instagram",
          analyzedAt: "2026-10-05T09:00:00Z",
          audienceFit: "Should never run.",
          storyStrategy: "Unrequested.",
        },
      ],
      storyPlans: [{
        platform: "tiktok",
        hook: "TikTok hook",
        script: "TikTok script.",
        storyBeats: [{ order: 1, role: "HOOK" }],
        creativeDecisions: {
          title: { enabled: false },
          subtitle: { required: false },
          voice: { required: false },
          music: { required: false },
        },
        goldenBindings: [
          { decisionArea: "STORY", moduleId: "STORY_TT", moduleVersion: "1.0.0", baselineId: "STORY_TT_BASE" },
          { decisionArea: "VISUAL_LAYOUT", moduleId: "LAYOUT_TT", moduleVersion: "1.0.0", baselineId: "LAYOUT_TT_BASE" },
          { decisionArea: "QC", moduleId: "QC_TT", moduleVersion: "1.0.0", baselineId: "QC_TT_BASE" },
        ],
      }],
    }),
  /Unrequested platform work is forbidden: instagram/,
);

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

const ideaRequest = {
  requestId: "creative-idea-001",
  targetPlatforms: ["tiktok"],
};

const ideaSelection = selectCreativeIdea({
  request: ideaRequest,
  ideas: [
    {
      id: "idea-emotional",
      platform: "tiktok",
      tone: "EMOTIONAL",
      hook: "Open on the owner preparing the shop before sunrise.",
      premise: "Show the human routine behind a familiar local business.",
      sourceStrategy: "CUSTOMER_ASSET_ONLY",
      emotionalTarget: "warmth and respect",
      storyBeats: [{ order: 1, role: "HUMAN_HOOK" }, { order: 2, role: "PROCESS" }],
      freshnessScore: 0.90,
      firstImpactScore: 0.82,
      audienceFitScore: 0.88,
      platformFitScore: 0.90,
      feasibilityScore: 0.92,
      truthSafetyScore: 0.98,
      repetitionRiskScore: 0.12,
    },
    {
      id: "idea-generic",
      platform: "tiktok",
      tone: "INFORMATIONAL",
      hook: "Here are three reasons to visit.",
      premise: "Generic list.",
      sourceStrategy: "CUSTOMER_ASSET_ONLY",
      emotionalTarget: "interest",
      storyBeats: [{ order: 1, role: "LIST" }],
      freshnessScore: 0.30,
      firstImpactScore: 0.45,
      audienceFitScore: 0.70,
      platformFitScore: 0.65,
      feasibilityScore: 0.95,
      truthSafetyScore: 0.98,
      repetitionRiskScore: 0.80,
    },
  ],
});
assert.equal(ideaSelection.selected.id, "idea-emotional");
assert.equal(ideaSelection.policy.repetitiveRecentConceptsBlocked, true);

assert.throws(
  () =>
    selectCreativeIdea({
      request: { requestId: "only-youtube", targetPlatforms: ["youtube"] },
      ideas: [{
        id: "wrong-platform",
        platform: "tiktok",
        tone: "FUN",
        hook: "Hook",
        premise: "Premise",
        sourceStrategy: "CUSTOMER_ASSET_ONLY",
        emotionalTarget: "fun",
        storyBeats: [{ order: 1, role: "HOOK" }],
        freshnessScore: 0.9,
        firstImpactScore: 0.9,
        audienceFitScore: 0.9,
        platformFitScore: 0.9,
        feasibilityScore: 0.9,
        truthSafetyScore: 0.9,
        repetitionRiskScore: 0.1,
      }],
    }),
  /unrequested platform/,
);

const impact = buildFirstImpactDecision({
  platform: "instagram",
  tone: "PREMIUM",
  availableEvidence: [],
  availableAssets: [{ kind: "SENSORY_DETAIL" }],
});
assert.equal(impact.hookMode, "SENSORY_DETAIL_FIRST");
assert.equal(impact.noForcedLargeText, true);
assert.equal(impact.noForcedMusic, true);
assert.equal(scoreCreativeIdea({
  freshnessScore: 1,
  firstImpactScore: 1,
  audienceFitScore: 1,
  platformFitScore: 1,
  feasibilityScore: 1,
  truthSafetyScore: 1,
  repetitionRiskScore: 0,
}), 1);


const titleSelection = selectCreativeTitle({
  request: { requestId: "title-001", targetPlatforms: ["tiktok"] },
  platform: "tiktok",
  titleRequired: true,
  candidates: [
    {
      id: "title-fresh",
      platform: "tiktok",
      text: "새벽 5시, 이 가게만 먼저 불이 켜지는 이유",
      angle: "HUMAN_CURIOSITY",
      noveltyScore: 0.94,
      firstImpactScore: 0.92,
      clarityScore: 0.90,
      relevanceScore: 0.95,
      platformFitScore: 0.91,
      truthSafetyScore: 0.99,
      curiosityScore: 0.93,
      repetitionRiskScore: 0.10,
      clickbaitRiskScore: 0.08,
    },
    {
      id: "title-generic",
      platform: "tiktok",
      text: "꼭 가봐야 할 맛집 3가지 이유",
      angle: "GENERIC_LIST",
      noveltyScore: 0.30,
      firstImpactScore: 0.45,
      clarityScore: 0.88,
      relevanceScore: 0.70,
      platformFitScore: 0.62,
      truthSafetyScore: 0.90,
      curiosityScore: 0.60,
      repetitionRiskScore: 0.84,
      clickbaitRiskScore: 0.42,
    },
  ],
});
assert.equal(titleSelection.selected.id, "title-fresh");
assert.equal(titleSelection.policy.repetitiveRecentTitlesBlocked, true);
assert.equal(titleSelection.policy.curiosityAllowedWithoutMisleadingClickbait, true);

const noTitle = selectCreativeTitle({
  request: { requestId: "title-off", targetPlatforms: ["instagram"] },
  platform: "instagram",
  titleRequired: false,
  candidates: [],
});
assert.equal(noTitle.selected, null);
assert.equal(noTitle.policy.noForcedTitle, true);

assert.throws(
  () =>
    selectCreativeTitle({
      request: { requestId: "title-off-bad", targetPlatforms: ["instagram"] },
      platform: "instagram",
      titleRequired: false,
      candidates: [{
        id: "should-not-exist",
        platform: "instagram",
        text: "Forced title",
        angle: "FORCED",
        noveltyScore: 1,
        firstImpactScore: 1,
        clarityScore: 1,
        relevanceScore: 1,
        platformFitScore: 1,
        truthSafetyScore: 1,
        curiosityScore: 1,
        repetitionRiskScore: 0,
        clickbaitRiskScore: 0,
      }],
    }),
  /must not be produced/,
);

assert.equal(scoreCreativeTitle({
  noveltyScore: 1,
  firstImpactScore: 1,
  clarityScore: 1,
  relevanceScore: 1,
  platformFitScore: 1,
  truthSafetyScore: 1,
  curiosityScore: 1,
  repetitionRiskScore: 0,
  clickbaitRiskScore: 0,
}), 1);
