const DIRECT_VISUAL_DIMENSIONS = new Set(["TYPOGRAPHY", "TEXT", "COLOR", "LAYOUT", "CUT", "TRANSITION", "CAMERA"]);

/**
 * Keeps the observable creative *principle* and provenance, never another creator's assets.
 * This is a planning brief, not an automated title/template choice or production permission.
 */
export function buildExternalCreativeBrief({ platform, bundle, desiredCountry = null, desiredContentClass = null }) {
  if (!bundle) return null;
  const cases = bundle.cases.filter((item) => item.platform === platform);
  const insights = [];
  const hypotheses = [];
  for (const item of cases) {
    for (const technique of item.techniques) {
      const isHypothesis = technique.basis === "HYPOTHESIS";
      const isVisual = DIRECT_VISUAL_DIMENSIONS.has(technique.dimension.toUpperCase());
      const evidence = Object.freeze({
        caseId: item.id,
        dimension: technique.dimension,
        observedMechanism: technique.description,
        basis: technique.basis,
        observedInVideo: technique.basis === "FRAME_OBSERVED",
        visualDetailVerified: isVisual && technique.basis === "FRAME_OBSERVED",
        contentClassMatch: Boolean(desiredContentClass && item.contentClass === desiredContentClass),
        countryMatch: Boolean(desiredCountry && item.country === desiredCountry),
        sourceUrl: item.sourceUrl,
        distribution: item.distribution,
        metricScopes: Object.freeze([...new Set(item.metrics.map((metric) => metric.scope))]),
        causalEffectProven: false,
        copyingPermitted: false,
      });
      (isHypothesis ? hypotheses : insights).push(evidence);
    }
  }
  // Context-matched and directly observed principles are surfaced first, without ranking by raw paid views.
  const sortByRelevance = (a, b) =>
    Number(b.contentClassMatch) - Number(a.contentClassMatch) ||
    Number(b.countryMatch) - Number(a.countryMatch) ||
    Number(b.observedInVideo) - Number(a.observedInVideo);
  insights.sort(sortByRelevance);
  hypotheses.sort(sortByRelevance);
  return Object.freeze({
    platform,
    status: "CREATIVE_RESEARCH_BRIEF_ONLY",
    caseCount: cases.length,
    insights: Object.freeze(insights),
    hypotheses: Object.freeze(hypotheses),
    needsOriginalIdeaGeneration: true,
    needsBrandSsotAndGoldenBinding: true,
    needsPlatformSpecificVisualDecisions: true,
    noCausalInferenceFromViewCounts: true,
    noReuseOfExternalMedia: true,
  });
}
