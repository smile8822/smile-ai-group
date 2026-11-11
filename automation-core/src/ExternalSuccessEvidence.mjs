const PLATFORMS = new Set(["tiktok", "instagram", "youtube", "facebook"]);
const DISTRIBUTION = new Set(["ORGANIC", "PAID", "MIXED"]);
const OBSERVATION = new Set(["FRAMES_REVIEWED", "CASE_DESCRIPTION_ONLY"]);
const EVIDENCE_BASIS = new Set(["FRAME_OBSERVED", "SOURCE_REPORTED", "HYPOTHESIS"]);
const MEASUREMENT_SCOPE = new Set(["SINGLE_VIDEO", "CAMPAIGN", "CREATOR_COHORT", "FORMAT_CATEGORY"]);

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function isoDate(value, label) {
  const str = requiredString(value, label);
  if (!Number.isFinite(Date.parse(str))) throw new Error(`${label} must be an ISO timestamp`);
  return str;
}

function httpsUrl(value, label) {
  const str = requiredString(value, label);
  try {
    const url = new URL(str);
    if (url.protocol !== "https:" || !url.hostname) throw new Error("invalid");
  } catch {
    throw new Error(`${label} must be an HTTPS URL`);
  }
  return str;
}

function inSet(value, allowed, label) {
  if (!allowed.has(value)) throw new Error(`Invalid ${label}: ${value}`);
  return value;
}

function normalizeMetric(metric, caseId, index) {
  const label = `${caseId}.metrics[${index}]`;
  const name = requiredString(metric.name, `${label}.name`);
  const value = Number(metric.value);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label}.value must be nonnegative and finite`);
  return Object.freeze({
    name,
    value,
    unit: requiredString(metric.unit, `${label}.unit`),
    scope: inSet(metric.scope, MEASUREMENT_SCOPE, `${label}.scope`),
    sourceUrl: httpsUrl(metric.sourceUrl, `${label}.sourceUrl`),
  });
}

function normalizeTechnique(technique, caseId, index, visualReviewStatus) {
  const label = `${caseId}.techniques[${index}]`;
  const basis = inSet(technique.basis, EVIDENCE_BASIS, `${label}.basis`);
  if (basis === "FRAME_OBSERVED" && visualReviewStatus !== "FRAMES_REVIEWED") {
    throw new Error(`${label} cannot claim frame observation without frame review`);
  }
  return Object.freeze({
    dimension: requiredString(technique.dimension, `${label}.dimension`),
    description: requiredString(technique.description, `${label}.description`),
    basis,
  });
}

/** Verified external examples are inspiration, never a customer Golden production baseline. */
export function validateExternalSuccessBundle({ targetPlatforms, bundle, required = false }) {
  if (typeof required !== "boolean") throw new Error("required must be a boolean");
  if (!Array.isArray(targetPlatforms) || targetPlatforms.length === 0) {
    throw new Error("targetPlatforms must be a non-empty array");
  }
  const targets = new Set(targetPlatforms);
  for (const platform of targets) inSet(platform, PLATFORMS, "target platform");

  if (!bundle) {
    if (required) throw new Error("External success evidence is required before creative planning");
    return null;
  }
  const reviewedAt = isoDate(bundle.reviewedAt, "externalSuccess.reviewedAt");
  if (!Array.isArray(bundle.cases) || bundle.cases.length === 0) {
    throw new Error("externalSuccess.cases must contain verified examples");
  }
  const seenIds = new Set();
  const normalized = bundle.cases.map((item, index) => {
    const label = `externalSuccess.cases[${index}]`;
    const id = requiredString(item.id, `${label}.id`);
    if (seenIds.has(id)) throw new Error(`Duplicate external success case: ${id}`);
    seenIds.add(id);
    const platform = inSet(item.platform, PLATFORMS, `${id}.platform`);
    if (!targets.has(platform)) throw new Error(`Unrequested platform external success case: ${platform}`);
    if (item.verified !== true) throw new Error(`${id} must have verified evidence`);
    const sourceUrl = httpsUrl(item.sourceUrl, `${id}.sourceUrl`);
    const observedAt = isoDate(item.observedAt, `${id}.observedAt`);
    if (Date.parse(observedAt) > Date.parse(reviewedAt)) {
      throw new Error(`${id} cannot be observed after the bundle review`);
    }
    const visualReviewStatus = inSet(item.visualReviewStatus, OBSERVATION, `${id}.visualReviewStatus`);
    if (!Array.isArray(item.metrics) || item.metrics.length === 0) {
      throw new Error(`${id} needs at least one verified performance metric`);
    }
    if (!Array.isArray(item.techniques) || item.techniques.length === 0) {
      throw new Error(`${id} needs technique analysis with evidence basis`);
    }
    return Object.freeze({
      id,
      platform,
      country: requiredString(item.country, `${id}.country`),
      sourceUrl,
      observedAt,
      verified: true,
      distribution: inSet(item.distribution, DISTRIBUTION, `${id}.distribution`),
      visualReviewStatus,
      contentClass: requiredString(item.contentClass, `${id}.contentClass`),
      metrics: Object.freeze(item.metrics.map((metric, i) => normalizeMetric(metric, id, i))),
      techniques: Object.freeze(item.techniques.map((technique, i) =>
        normalizeTechnique(technique, id, i, visualReviewStatus))),
      copyingProhibited: true,
      goldenProductionMethod: false,
    });
  });

  if (required) {
    for (const platform of targets) {
      if (!normalized.some((item) => item.platform === platform)) {
        throw new Error(`Missing external success research for requested platform: ${platform}`);
      }
    }
  }

  return Object.freeze({
    owner: "SMILE_AI_GROUP",
    reviewedAt,
    status: "RESEARCH_ONLY_NOT_GOLDEN",
    cases: Object.freeze(normalized),
  });
}

/** An explicit creative decision must cite its own platform's external cases. */
export function validateCreativeBenchmarkDecision({ platform, analysis, bundle, required = false }) {
  if (!bundle) {
    if (required) throw new Error(`Missing external benchmark bundle for ${platform}`);
    return null;
  }
  const refs = analysis?.externalCaseRefs || [];
  if (!Array.isArray(refs)) throw new Error(`${platform}.externalCaseRefs must be an array`);
  if (required && refs.length === 0) throw new Error(`${platform}.externalCaseRefs are required`);
  if (refs.length > 0 && !analysis?.originalityStrategy?.trim()) {
    throw new Error(`${platform}.originalityStrategy is required to prevent copying`);
  }
  const matching = new Set(bundle.cases.filter((item) => item.platform === platform).map((item) => item.id));
  for (const id of refs) {
    if (!matching.has(id)) throw new Error(`${platform} cites unverified or cross-platform external case: ${id}`);
  }
  return Object.freeze({
    externalCaseRefs: Object.freeze([...new Set(refs)]),
    originalityStrategy: refs.length ? analysis.originalityStrategy.trim() : null,
    evidenceRole: "INSPIRATION_NOT_PRODUCTION_APPROVAL",
  });
}
