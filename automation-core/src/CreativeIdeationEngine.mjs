const CREATIVE_TONES = Object.freeze([
  "EMOTIONAL",
  "FUN",
  "SURPRISE",
  "INFORMATIONAL",
  "TRUST",
  "PREMIUM",
  "RELATABLE",
  "PARTICIPATORY",
  "LIVE_SCENE",
  "BEFORE_AFTER",
]);

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

function finiteScore(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    throw new Error(`${label} must be between 0 and 1`);
  }
  return n;
}

function freezeArray(values = []) {
  return Object.freeze(values.map((value) =>
    value && typeof value === "object" ? Object.freeze({ ...value }) : value,
  ));
}

export function scoreCreativeIdea(idea) {
  const freshness = finiteScore(idea.freshnessScore, "freshnessScore");
  const firstImpact = finiteScore(idea.firstImpactScore, "firstImpactScore");
  const audienceFit = finiteScore(idea.audienceFitScore, "audienceFitScore");
  const platformFit = finiteScore(idea.platformFitScore, "platformFitScore");
  const feasibility = finiteScore(idea.feasibilityScore, "feasibilityScore");
  const truthSafety = finiteScore(idea.truthSafetyScore, "truthSafetyScore");
  const repetitionRisk = finiteScore(idea.repetitionRiskScore, "repetitionRiskScore");

  const score =
    freshness * 0.22 +
    firstImpact * 0.22 +
    audienceFit * 0.16 +
    platformFit * 0.16 +
    feasibility * 0.12 +
    truthSafety * 0.12 -
    repetitionRisk * 0.20;

  return Math.max(0, Math.min(1, Number(score.toFixed(4))));
}

function validateIdea(idea, request) {
  const id = requireString(idea.id, "idea.id");
  const platform = requireString(idea.platform, "idea.platform");
  if (!(request.targetPlatforms || []).includes(platform)) {
    throw new Error(`Idea ${id} targets unrequested platform: ${platform}`);
  }

  const tone = requireString(idea.tone, "idea.tone");
  if (!CREATIVE_TONES.includes(tone)) {
    throw new Error(`Unsupported creative tone: ${tone}`);
  }

  const hook = requireString(idea.hook, "idea.hook");
  const premise = requireString(idea.premise, "idea.premise");
  const sourceStrategy = requireString(idea.sourceStrategy, "idea.sourceStrategy");
  const emotionalTarget = requireString(idea.emotionalTarget, "idea.emotionalTarget");

  if (!Array.isArray(idea.storyBeats) || idea.storyBeats.length === 0) {
    throw new Error(`Idea ${id} requires storyBeats`);
  }

  const score = scoreCreativeIdea(idea);

  return Object.freeze({
    id,
    platform,
    tone,
    hook,
    premise,
    sourceStrategy,
    emotionalTarget,
    storyBeats: freezeArray(idea.storyBeats),
    visualMotifs: freezeArray(idea.visualMotifs || []),
    titleConcepts: Object.freeze([...(idea.titleConcepts || [])]),
    evidenceRefs: Object.freeze([...(idea.evidenceRefs || [])]),
    freshnessScore: Number(idea.freshnessScore),
    firstImpactScore: Number(idea.firstImpactScore),
    audienceFitScore: Number(idea.audienceFitScore),
    platformFitScore: Number(idea.platformFitScore),
    feasibilityScore: Number(idea.feasibilityScore),
    truthSafetyScore: Number(idea.truthSafetyScore),
    repetitionRiskScore: Number(idea.repetitionRiskScore),
    compositeScore: score,
  });
}

export function selectCreativeIdea({
  request,
  ideas,
  minimumScore = 0.62,
  maximumRepetitionRisk = 0.45,
}) {
  if (!request || typeof request !== "object") {
    throw new Error("request is required");
  }
  if (!Array.isArray(ideas) || ideas.length === 0) {
    throw new Error("ideas are required");
  }

  const validated = ideas.map((idea) => validateIdea(idea, request));
  const eligible = validated
    .filter((idea) => idea.compositeScore >= minimumScore)
    .filter((idea) => idea.repetitionRiskScore <= maximumRepetitionRisk)
    .sort((a, b) => {
      if (a.compositeScore !== b.compositeScore) {
        return b.compositeScore - a.compositeScore;
      }
      if (a.firstImpactScore !== b.firstImpactScore) {
        return b.firstImpactScore - a.firstImpactScore;
      }
      return a.id.localeCompare(b.id);
    });

  if (eligible.length === 0) {
    throw new Error("No creative idea passed novelty, impact, fit, feasibility and repetition gates.");
  }

  return Object.freeze({
    owner: "SMILE_AI_GROUP",
    requestId: request.requestId || null,
    selected: eligible[0],
    alternatives: Object.freeze(eligible.slice(1, 4)),
    rejectedCount: validated.length - eligible.length,
    policy: Object.freeze({
      noveltyRequired: true,
      firstImpactRequired: true,
      platformSpecific: true,
      repetitiveRecentConceptsBlocked: true,
      truthAndFeasibilityRequired: true,
      selectedIdeaDoesNotAuthorizeUnverifiedProductionTechnique: true,
    }),
  });
}

export function buildFirstImpactDecision({
  platform,
  tone,
  availableEvidence = [],
  availableAssets = [],
}) {
  requireString(platform, "platform");
  requireString(tone, "tone");

  const hasFaceReaction = availableAssets.some((asset) => asset.kind === "FACE_REACTION");
  const hasBeforeAfter = availableAssets.some((asset) => asset.kind === "BEFORE_AFTER");
  const hasLiveMoment = availableAssets.some((asset) => asset.kind === "LIVE_MOMENT");
  const hasStrongFact = availableEvidence.some((item) => item.strength === "HIGH");
  const hasSensoryDetail = availableAssets.some((asset) => asset.kind === "SENSORY_DETAIL");

  let hookMode = "QUESTION_OR_PROMISE";
  if (tone === "EMOTIONAL" && hasFaceReaction) hookMode = "HUMAN_EMOTION_FIRST";
  else if (tone === "FUN" && hasFaceReaction) hookMode = "REACTION_OR_COMEDIC_BEAT_FIRST";
  else if (tone === "SURPRISE" && hasBeforeAfter) hookMode = "REVEAL_OR_BEFORE_AFTER_FIRST";
  else if (tone === "LIVE_SCENE" && hasLiveMoment) hookMode = "LIVE_SCENE_FIRST";
  else if (tone === "INFORMATIONAL" && hasStrongFact) hookMode = "VERIFIED_FACT_FIRST";
  else if (tone === "PREMIUM" && hasSensoryDetail) hookMode = "SENSORY_DETAIL_FIRST";

  return Object.freeze({
    platform,
    tone,
    hookWindowSec: platform === "youtube" ? [0, 3] : [0, 2],
    hookMode,
    textDensity: tone === "PREMIUM" || tone === "EMOTIONAL" ? "LOW_TO_MEDIUM" : "MEDIUM",
    mustUseVerifiedEvidenceForClaims: true,
    mustUseAvailableAssetsOnly: true,
    noForcedLargeText: true,
    noForcedMusic: true,
    noForcedVoice: true,
  });
}

export { CREATIVE_TONES };
