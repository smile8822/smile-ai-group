import { findGoldenModules } from "./GoldenModuleRegistry.mjs";

const REQUIRED_CAPABILITIES_BY_OUTPUT = Object.freeze({
  SOCIAL_SHORT: [
    "ASSET_SELECTION",
    "STORY_PLANNING",
    "VIDEO_RENDER",
    "QC",
  ],
  LONG_VIDEO: [
    "ASSET_SELECTION",
    "STORY_PLANNING",
    "VIDEO_RENDER",
    "QC",
  ],
  PHOTO_STORY: [
    "PHOTO_SELECTION",
    "STORY_PLANNING",
    "VIDEO_RENDER",
    "QC",
  ],
  PRODUCT_PROMO: [
    "PRODUCT_ASSET_SELECTION",
    "STORY_PLANNING",
    "VIDEO_RENDER",
    "QC",
  ],
});

function unique(values) {
  return [...new Set(values)];
}

function chooseModule(capability, request) {
  const candidates = findGoldenModules({
    capability,
    serviceScope: request.serviceScope,
  }).filter((module) => {
    if (
      request.inputClasses?.length &&
      !request.inputClasses.some((inputClass) =>
        module.accepts.includes(inputClass),
      )
    ) {
      return false;
    }
    if (
      module.constraints.languages &&
      request.language &&
      !module.constraints.languages.includes(request.language)
    ) {
      return false;
    }
    if (
      module.constraints.platforms &&
      request.platform &&
      !module.constraints.platforms.includes(request.platform)
    ) {
      return false;
    }
    return true;
  });

  if (candidates.length === 0) {
    throw new Error(`No VERIFIED Golden Module satisfies capability: ${capability}`);
  }

  return [...candidates].sort((a, b) => {
    const qa = Number(a.qualityScore ?? 0);
    const qb = Number(b.qualityScore ?? 0);
    if (qa !== qb) return qb - qa;
    const ca = Number(a.estimatedUnitCost ?? Number.POSITIVE_INFINITY);
    const cb = Number(b.estimatedUnitCost ?? Number.POSITIVE_INFINITY);
    if (ca !== cb) return ca - cb;
    return a.id.localeCompare(b.id);
  })[0];
}

export function composeGoldenPipeline(request) {
  if (!request || typeof request !== "object") {
    throw new Error("Production request is required.");
  }
  if (!request.requestId || !request.tenantId || !request.outputKind) {
    throw new Error("requestId, tenantId, and outputKind are required.");
  }
  const base = REQUIRED_CAPABILITIES_BY_OUTPUT[request.outputKind];
  if (!base) throw new Error(`Unsupported outputKind: ${request.outputKind}`);

  const capabilities = [...base];

  if (request.requiresVoice) capabilities.splice(2, 0, "VOICE");
  if (request.requiresCharacter) capabilities.splice(2, 0, "CHARACTER_BINDING");
  if (request.publish === true) capabilities.push("PUBLISHING");
  if (request.largeMedia === true) capabilities.unshift("LARGE_MEDIA_ASSETIZATION");

  const orderedCapabilities = unique(capabilities);
  const modules = orderedCapabilities.map((capability) => ({
    capability,
    module: chooseModule(capability, request),
  }));

  const plan = {
    planVersion: 1,
    owner: "SMILE_AI_GROUP",
    requestId: request.requestId,
    tenantId: request.tenantId,
    serviceScope: request.serviceScope || "CUSTOMER_AI_AUTOMATION",
    outputKind: request.outputKind,
    language: request.language || null,
    platform: request.platform || null,
    capabilities: orderedCapabilities,
    moduleBindings: modules.map(({ capability, module }) => ({
      capability,
      moduleId: module.id,
      moduleVersion: module.version,
    })),
    locked: true,
  };

  return Object.freeze({
    ...plan,
    capabilities: Object.freeze([...plan.capabilities]),
    moduleBindings: Object.freeze(
      plan.moduleBindings.map((binding) => Object.freeze(binding)),
    ),
  });
}

export { REQUIRED_CAPABILITIES_BY_OUTPUT };
