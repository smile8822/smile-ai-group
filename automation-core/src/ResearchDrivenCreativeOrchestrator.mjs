import { validateExternalSuccessBundle } from "./ExternalSuccessEvidence.mjs";
import { createCreativeExecutionSpec } from "./CreativeDirector.mjs";
import { buildFirstImpactDecision, selectCreativeIdea, selectCreativeTitle } from "./CreativeIdeationEngine.mjs";
import { selectBrandVisualTreatment } from "./BrandVisualTreatment.mjs";

function required(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function requestedPlatformInputs(targetPlatforms, platformInputs) {
  if (!Array.isArray(platformInputs)) throw new Error("platformInputs must be an array");
  const expected = new Set(targetPlatforms);
  const found = new Map();
  for (const input of platformInputs) {
    const platform = required(input.platform, "platformInput.platform");
    if (!expected.has(platform)) throw new Error(`Unrequested platform creative input: ${platform}`);
    if (found.has(platform)) throw new Error(`Duplicate platform creative input: ${platform}`);
    found.set(platform, input);
  }
  for (const platform of targetPlatforms) {
    if (!found.has(platform)) throw new Error(`Missing platform creative input: ${platform}`);
  }
  return found;
}

/**
 * New, opt-in, quality-gated route for research-driven creative planning.
 * It produces no media and performs no publication or external network request.
 * External researched mechanisms must precede original ideas; approved Golden techniques still own rendering.
 */
export function createResearchDrivenCreativePlan({
  request,
  externalSuccessBundle,
  researchBundle = null,
  platformInputs,
  brandVisualPolicy,
}) {
  if (!request || typeof request !== "object") throw new Error("request is required");
  const targetPlatforms = [...new Set(request.targetPlatforms || [])];
  if (targetPlatforms.length === 0) throw new Error("requested platforms are required");

  // The new research-first route requires a real frame review for *every* requested SNS.
  // Legacy planning via createCreativeExecutionSpec remains unaffected.
  const evidence = validateExternalSuccessBundle({
    targetPlatforms,
    bundle: externalSuccessBundle,
    required: true,
    requireDirectVideoReview: true,
  });
  const inputs = requestedPlatformInputs(targetPlatforms, platformInputs);
  const platformAnalyses = [];
  const storyPlans = [];
  const selections = [];

  for (const platform of targetPlatforms) {
    const input = inputs.get(platform);
    const platformAnalysis = input.analysis;
    if (!platformAnalysis || typeof platformAnalysis !== "object") {
      throw new Error(`${platform}.analysis is required`);
    }
    const caseRefs = platformAnalysis.externalCaseRefs;
    if (!Array.isArray(caseRefs) || !caseRefs.length) {
      throw new Error(`${platform} must cite a real external success case before creative generation`);
    }
    const availableCases = new Set(evidence.cases.filter((item) => item.platform === platform).map((item) => item.id));
    for (const caseId of caseRefs) {
      if (!availableCases.has(caseId)) throw new Error(`${platform} cites a missing or wrong-platform case: ${caseId}`);
    }
    required(platformAnalysis.originalityStrategy, `${platform}.originalityStrategy`);
    const platformRequest = { ...request, targetPlatforms: [platform] };
    const selectedIdea = selectCreativeIdea({ request: platformRequest, ideas: input.ideaCandidates });
    if (!selectedIdea.selected.evidenceRefs.some((ref) => caseRefs.includes(ref))) {
      throw new Error(`${platform} selected idea must trace to an actual external success case`);
    }
    const selectedTitle = selectCreativeTitle({
      request: platformRequest,
      platform,
      titleRequired: input.titleRequired,
      candidates: input.titleCandidates || [],
    });
    if (selectedTitle.titleRequired &&
        !selectedTitle.selected.evidenceRefs.some((ref) => caseRefs.includes(ref))) {
      throw new Error(`${platform} selected title must trace to a verified platform-specific external case`);
    }
    const selectedTreatment = selectBrandVisualTreatment({
      platform,
      titleRequired: input.titleRequired,
      candidates: input.visualCandidates || [],
      approvedPolicy: brandVisualPolicy,
      recentTreatmentIds: input.recentTreatmentIds || [],
    });
    const script = required(input.scriptsByIdeaId?.[selectedIdea.selected.id], `${platform}.selectedIdeaScript`);
    const opening = buildFirstImpactDecision({
      platform,
      tone: selectedIdea.selected.tone,
      availableEvidence: input.hookEvidence || [],
      availableAssets: input.availableAssets || [],
    });
    const title = selectedTitle.titleRequired
      ? {
          enabled: true,
          text: selectedTitle.selected.text,
          fontRole: selectedTreatment.selected.fontRole,
          colorStrategy: selectedTreatment.selected.colorToken,
          backgroundToken: selectedTreatment.selected.backgroundToken,
          boxMode: selectedTreatment.selected.boxMode,
          widthMode: selectedTreatment.selected.widthMode,
          sizeStrategy: selectedTreatment.selected.sizeStrategy,
          requiresFrameContrastQC: true,
        }
      : { enabled: false };

    platformAnalyses.push({ ...platformAnalysis, platform });
    storyPlans.push({
      platform,
      hook: selectedIdea.selected.hook,
      script,
      storyBeats: selectedIdea.selected.storyBeats,
      evidenceRefs: selectedIdea.selected.evidenceRefs,
      creativeDecisions: {
        title,
        subtitle: input.subtitle || { required: false },
        voice: input.voice || { required: false },
        music: input.music || { required: false },
        sceneLabels: { openingDecision: opening },
        thumbnail: input.thumbnail || {},
        callToAction: input.callToAction || {},
      },
      goldenBindings: input.goldenBindings,
    });
    selections.push(Object.freeze({
      platform,
      originalIdea: selectedIdea.selected,
      selectedTitle: selectedTitle.selected,
      selectedTreatment: selectedTreatment.selected,
      firstImpact: opening,
      externalCaseRefs: Object.freeze([...caseRefs]),
    }));
  }

  const spec = createCreativeExecutionSpec({
    request: {
      ...request,
      requireExternalSuccessResearch: true,
      requireDirectVideoReview: true,
    },
    externalSuccessBundle,
    researchBundle,
    platformAnalyses,
    storyPlans,
  });
  return Object.freeze({
    status: "ORIGINAL_PLANS_PREPARED_NOT_RENDERED",
    owner: "SMILE_AI_GROUP",
    creativeExecutionSpec: spec,
    selections: Object.freeze(selections),
    productionPermission: false,
    publicationPermission: false,
    nextGate: "VERIFY_ACTUAL_GOLDEN_MODULES_RENDER_FRAME_QC_RIGHTS_AND_OWNER_APPROVAL",
  });
}
