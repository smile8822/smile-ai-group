/** Versioned mirror of assetIdentity.group.palette in the canonical machine SSOT. */
export const CANONICAL_PARENT_PALETTE = Object.freeze({
  deepNavy: "#071425",
  gold: "#FFC86B",
  purple: "#A855F7",
  aiBlue: "#00D1FF",
  futureCyan: "#00E5FF",
  onDark: "#F7FAFF",
});

const CANONICAL_MACHINE_SSOT = "smile-ai-group/smile-ai-group:config/group-brand-design.json@automation/smile-ai-group-guardrails";

function text(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function score(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new Error(`${label} must be between 0 and 1`);
  }
  return number;
}

function relativeLuminance(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error("Approved palette entries must be #RRGGBB colors");
  const components = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = components.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function calculateContrastRatio(foreground, background) {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  return Number(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(3));
}

function approved(value, list, label) {
  const result = text(value, label);
  if (!Array.isArray(list) || !list.includes(result)) {
    throw new Error(`${label} is not in the verified Brand/Golden allowlist: ${result}`);
  }
  return result;
}

/** Chooses an original title treatment only from currently approved Brand/Golden methods. */
export function selectBrandVisualTreatment({
  platform,
  titleRequired,
  candidates = [],
  approvedPolicy,
  recentTreatmentIds = [],
}) {
  const target = text(platform, "platform");
  if (titleRequired === false) {
    if (candidates.length) throw new Error("Title-off stories must not create visual title treatments");
    return Object.freeze({ platform: target, enabled: false, selected: null, alternatives: Object.freeze([]), noForcedTitle: true });
  }
  if (titleRequired !== true) throw new Error("titleRequired must be explicitly true or false");
  if (!approvedPolicy || typeof approvedPolicy !== "object") {
    throw new Error("Verified Brand/Golden visual policy is required");
  }
  if (text(approvedPolicy.sourceRef, "approvedPolicy.sourceRef") !== CANONICAL_MACHINE_SSOT) {
    throw new Error("Visual policy must reference the canonical machine SSOT branch");
  }
  const palette = approvedPolicy.palette;
  if (!palette || typeof palette !== "object" || Object.keys(palette).length !== Object.keys(CANONICAL_PARENT_PALETTE).length ||
      Object.entries(CANONICAL_PARENT_PALETTE).some(([name, value]) => palette[name] !== value)) {
    throw new Error("Visual policy palette differs from versioned canonical group brand tokens");
  }
  if (!Array.isArray(candidates) || candidates.length < 2) {
    throw new Error("Generate at least two visual treatment candidates for a non-fixed style");
  }
  const ids = new Set();
  const recent = new Set(recentTreatmentIds);
  const entries = candidates.map((item) => {
    const id = text(item.id, "treatment.id");
    if (ids.has(id)) throw new Error(`Duplicate visual treatment: ${id}`);
    ids.add(id);
    if (item.platform !== target) throw new Error(`Visual treatment ${id} platform mismatch`);
    const fontRole = approved(item.fontRole, approvedPolicy.approvedFontRoles, `${id}.fontRole`);
    const colorToken = text(item.colorToken, `${id}.colorToken`);
    const backgroundToken = text(item.backgroundToken, `${id}.backgroundToken`);
    if (!palette || !Object.hasOwn(palette, colorToken) || !Object.hasOwn(palette, backgroundToken)) {
      throw new Error(`${id} uses a color outside the canonical group palette`);
    }
    const boxMode = approved(item.boxMode, approvedPolicy.verifiedBoxModes, `${id}.boxMode`);
    const widthMode = approved(item.widthMode, approvedPolicy.verifiedWidthModes, `${id}.widthMode`);
    const sizeStrategy = approved(item.sizeStrategy, approvedPolicy.verifiedSizeStrategies, `${id}.sizeStrategy`);
    const contrastRatio = calculateContrastRatio(palette[colorToken], palette[backgroundToken]);
    const backgroundIsMovingFootage = boxMode === "NO_BOX";
    if (!backgroundIsMovingFootage && contrastRatio < 3) {
      throw new Error(`${id} fails minimum large-title text contrast 3:1 (${contrastRatio})`);
    }
    const novelty = score(item.noveltyScore, `${id}.noveltyScore`);
    const platformFit = score(item.platformFitScore, `${id}.platformFitScore`);
    const firstImpact = score(item.firstImpactScore, `${id}.firstImpactScore`);
    const legibility = score(item.legibilityScore, `${id}.legibilityScore`);
    const repetition = score(item.repetitionRiskScore, `${id}.repetitionRiskScore`);
    const compositeScore = Number(Math.max(0, Math.min(1,
      novelty * 0.26 + platformFit * 0.24 + firstImpact * 0.26 + legibility * 0.24 - repetition * 0.24,
    )).toFixed(4));
    return Object.freeze({
      id, platform: target, fontRole, colorToken, backgroundToken,
      boxMode, widthMode, sizeStrategy, contrastRatio,
      creativeRationale: text(item.creativeRationale, `${id}.creativeRationale`),
      compositeScore,
      repetitionRiskScore: repetition,
      requiresFrameContrastQC: true, // Even a static palette contrast check cannot establish legibility on video frames.
      awaitingActualRenderQA: true,
      sourceRef: approvedPolicy.sourceRef,
      isExactRecentRepeat: recent.has(id),
    });
  });
  const eligible = entries
    .filter((entry) => entry.compositeScore >= 0.62)
    .filter((entry) => entry.repetitionRiskScore <= 0.45)
    .filter((entry) => !entry.isExactRecentRepeat)
    .sort((a, b) => b.compositeScore - a.compositeScore || a.id.localeCompare(b.id));
  if (!eligible.length) throw new Error("No original Brand/Golden visual treatment passed quality and repetition checks");
  return Object.freeze({
    platform: target,
    enabled: true,
    selected: eligible[0],
    alternatives: Object.freeze(eligible.slice(1, 4)),
    rejectedCount: entries.length - eligible.length,
    productionStatus: "REQUIRES_RENDER_FRAME_QC",
    dynamicCreativeSelection: true,
    stillBoundToApprovedBrandAndGoldenMethods: true,
  });
}
