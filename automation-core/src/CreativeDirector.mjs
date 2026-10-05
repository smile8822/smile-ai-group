const SUPPORTED_PLATFORMS = new Set([
  "tiktok",
  "instagram",
  "youtube",
  "facebook",
]);

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be explicitly true or false`);
  }
  return value;
}

function parseTime(value, label) {
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) throw new Error(`${label} must be an ISO date/time`);
  return ts;
}

function freezeArray(values = []) {
  return Object.freeze(values.map((value) =>
    value && typeof value === "object" ? Object.freeze({ ...value }) : value,
  ));
}

export function requestNeedsFreshContext(request) {
  return Boolean(
    request.latestNews === true ||
      request.latestInformation === true ||
      request.trendSensitive === true ||
      Number.isFinite(request.maxEvidenceAgeMinutes),
  );
}

export function validateResearchBundle(request, bundle) {
  const freshRequired = requestNeedsFreshContext(request);
  if (!freshRequired && !bundle) return null;
  if (!bundle || !Array.isArray(bundle.items) || bundle.items.length === 0) {
    throw new Error("Fresh-context request requires a non-empty verified research bundle.");
  }

  const checkedAt = requireString(bundle.checkedAt, "research.checkedAt");
  const checkedAtMs = parseTime(checkedAt, "research.checkedAt");
  const maxAgeMinutes = Number.isFinite(request.maxEvidenceAgeMinutes)
    ? Number(request.maxEvidenceAgeMinutes)
    : request.latestNews === true
      ? 180
      : 1440;

  const items = bundle.items.map((item, index) => {
    if (item.verified !== true) {
      throw new Error(`research.items[${index}] must be verified`);
    }
    const claim = requireString(item.claim, `research.items[${index}].claim`);
    const sourceRef = requireString(
      item.sourceRef || item.sourceUrl,
      `research.items[${index}].sourceRef`,
    );
    const observedAt = requireString(
      item.observedAt || item.publishedAt,
      `research.items[${index}].observedAt`,
    );
    const observedAtMs = parseTime(observedAt, `research.items[${index}].observedAt`);
    const ageMinutes = (checkedAtMs - observedAtMs) / 60000;

    if (freshRequired && (ageMinutes < 0 || ageMinutes > maxAgeMinutes)) {
      throw new Error(
        `research.items[${index}] is stale for this request: ${ageMinutes.toFixed(1)} minutes old`,
      );
    }

    return Object.freeze({
      claim,
      sourceRef,
      observedAt,
      verified: true,
      category: item.category || "GENERAL",
      locale: item.locale || null,
    });
  });

  return Object.freeze({
    checkedAt,
    maxAgeMinutes,
    items: Object.freeze(items),
  });
}

function validateCreativeDecisions(platform, decisions) {
  if (!decisions || typeof decisions !== "object") {
    throw new Error(`${platform} creativeDecisions are required`);
  }

  const titleEnabled = requireBoolean(decisions.title?.enabled, `${platform}.title.enabled`);
  const subtitleRequired = requireBoolean(
    decisions.subtitle?.required,
    `${platform}.subtitle.required`,
  );
  const voiceRequired = requireBoolean(decisions.voice?.required, `${platform}.voice.required`);
  const musicRequired = requireBoolean(decisions.music?.required, `${platform}.music.required`);

  if (titleEnabled) {
    requireString(decisions.title.fontRole, `${platform}.title.fontRole`);
    requireString(decisions.title.colorStrategy, `${platform}.title.colorStrategy`);
    requireString(decisions.title.boxMode, `${platform}.title.boxMode`);
    requireString(decisions.title.widthMode, `${platform}.title.widthMode`);
  }

  if (subtitleRequired) {
    requireString(decisions.subtitle.language, `${platform}.subtitle.language`);
    requireString(decisions.subtitle.timingMode, `${platform}.subtitle.timingMode`);
    requireString(decisions.subtitle.highlightMode, `${platform}.subtitle.highlightMode`);
  }

  if (voiceRequired) {
    requireString(decisions.voice.assetPolicy, `${platform}.voice.assetPolicy`);
  }

  if (musicRequired) {
    requireString(decisions.music.role, `${platform}.music.role`);
  }

  return Object.freeze({
    title: Object.freeze({ ...(decisions.title || {}), enabled: titleEnabled }),
    subtitle: Object.freeze({ ...(decisions.subtitle || {}), required: subtitleRequired }),
    voice: Object.freeze({ ...(decisions.voice || {}), required: voiceRequired }),
    music: Object.freeze({ ...(decisions.music || {}), required: musicRequired }),
    sceneLabels: Object.freeze({ ...(decisions.sceneLabels || {}) }),
    transitions: Object.freeze({ ...(decisions.transitions || {}) }),
    thumbnail: Object.freeze({ ...(decisions.thumbnail || {}) }),
    callToAction: Object.freeze({ ...(decisions.callToAction || {}) }),
  });
}

function validateGoldenBindings(platform, decisions, bindings = []) {
  const byArea = new Map(bindings.map((binding) => [binding.decisionArea, binding]));
  const requiredAreas = ["STORY", "VISUAL_LAYOUT", "QC"];
  if (decisions.subtitle.required) requiredAreas.push("SUBTITLE");
  if (decisions.voice.required) requiredAreas.push("VOICE");
  if (decisions.music.required) requiredAreas.push("MUSIC");

  for (const area of requiredAreas) {
    const binding = byArea.get(area);
    if (!binding) {
      throw new Error(`${platform} requires Golden binding for ${area}`);
    }
    requireString(binding.moduleId, `${platform}.${area}.moduleId`);
    requireString(binding.moduleVersion, `${platform}.${area}.moduleVersion`);
    requireString(binding.baselineId, `${platform}.${area}.baselineId`);
  }

  return freezeArray(bindings);
}

export function createCreativeExecutionSpec({
  request,
  researchBundle,
  platformAnalyses,
  storyPlans,
}) {
  if (!request || typeof request !== "object") {
    throw new Error("Creative request is required.");
  }

  const requestId = requireString(request.requestId, "request.requestId");
  const tenantId = requireString(request.tenantId, "request.tenantId");
  const objective = requireString(request.objective, "request.objective");
  const targetPlatforms = [...new Set(request.targetPlatforms || [])];

  if (targetPlatforms.length === 0) {
    throw new Error("At least one target platform is required.");
  }
  for (const platform of targetPlatforms) {
    if (!SUPPORTED_PLATFORMS.has(platform)) {
      throw new Error(`Unsupported social platform: ${platform}`);
    }
  }

  const verifiedResearch = validateResearchBundle(request, researchBundle);
  const analyses = new Map((platformAnalyses || []).map((item) => [item.platform, item]));
  const plans = new Map((storyPlans || []).map((item) => [item.platform, item]));

  const platformStories = targetPlatforms.map((platform) => {
    const analysis = analyses.get(platform);
    const plan = plans.get(platform);
    if (!analysis) throw new Error(`Missing platform analysis: ${platform}`);
    if (!plan) throw new Error(`Missing story plan: ${platform}`);

    const analyzedAt = requireString(analysis.analyzedAt, `${platform}.analyzedAt`);
    parseTime(analyzedAt, `${platform}.analyzedAt`);
    requireString(analysis.audienceFit, `${platform}.audienceFit`);
    requireString(analysis.storyStrategy, `${platform}.storyStrategy`);
    requireString(plan.hook, `${platform}.hook`);
    requireString(plan.script, `${platform}.script`);

    if (!Array.isArray(plan.storyBeats) || plan.storyBeats.length === 0) {
      throw new Error(`${platform}.storyBeats are required`);
    }

    const creativeDecisions = validateCreativeDecisions(platform, plan.creativeDecisions);
    const goldenBindings = validateGoldenBindings(
      platform,
      creativeDecisions,
      plan.goldenBindings,
    );

    return Object.freeze({
      platform,
      analyzedAt,
      audienceFit: analysis.audienceFit,
      storyStrategy: analysis.storyStrategy,
      trendSignals: freezeArray(analysis.trendSignals || []),
      recommendedDurationSec: Number(analysis.recommendedDurationSec || 0) || null,
      hook: plan.hook,
      script: plan.script,
      storyBeats: freezeArray(plan.storyBeats),
      evidenceRefs: Object.freeze([...(plan.evidenceRefs || [])]),
      creativeDecisions,
      goldenBindings,
    });
  });

  return Object.freeze({
    specVersion: 1,
    owner: "SMILE_AI_GROUP",
    requestId,
    tenantId,
    serviceScope: request.serviceScope || "CUSTOMER_AI_AUTOMATION",
    objective,
    audience: request.audience || null,
    country: request.country || null,
    language: request.language || null,
    latestNews: request.latestNews === true,
    latestInformation: request.latestInformation === true,
    trendSensitive: request.trendSensitive === true,
    research: verifiedResearch,
    targetPlatforms: Object.freeze(targetPlatforms),
    platformStories: Object.freeze(platformStories),
    locked: true,
  });
}

export { SUPPORTED_PLATFORMS };
