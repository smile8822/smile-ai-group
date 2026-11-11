import assert from "node:assert/strict";
import { calculateContrastRatio, selectBrandVisualTreatment } from "../src/BrandVisualTreatment.mjs";

const approvedPolicy = {
  sourceRef: "smile-ai-group/smile-ai-group:config/group-brand-design.json@automation/smile-ai-group-guardrails",
  palette: {
    gold: "#FFC86B",
    purple: "#A855F7",
    aiBlue: "#00D1FF",
    futureCyan: "#00E5FF",
    deepNavy: "#071425",
    onDark: "#F7FAFF",
  },
  approvedFontRoles: ["VERIFIED_SOCIAL_DISPLAY"],
  verifiedBoxModes: ["AUTO_WIDTH", "NO_BOX"],
  verifiedWidthModes: ["MEASURED_TEXT_AUTO_WIDTH"],
  verifiedSizeStrategies: ["READABLE_AUTO_SIZE"],
};
const candidates = [
  {
    id: "CINEMATIC_GOLD",
    platform: "tiktok",
    fontRole: "VERIFIED_SOCIAL_DISPLAY",
    colorToken: "gold",
    backgroundToken: "deepNavy",
    boxMode: "AUTO_WIDTH",
    widthMode: "MEASURED_TEXT_AUTO_WIDTH",
    sizeStrategy: "READABLE_AUTO_SIZE",
    creativeRationale: "Sparse gold hook to preserve the documentary image",
    noveltyScore: 0.95,
    platformFitScore: 0.93,
    firstImpactScore: 0.90,
    legibilityScore: 0.93,
    repetitionRiskScore: 0.08,
  },
  {
    id: "CYAN_UNBOXED",
    platform: "tiktok",
    fontRole: "VERIFIED_SOCIAL_DISPLAY",
    colorToken: "futureCyan",
    backgroundToken: "deepNavy",
    boxMode: "NO_BOX",
    widthMode: "MEASURED_TEXT_AUTO_WIDTH",
    sizeStrategy: "READABLE_AUTO_SIZE",
    creativeRationale: "Lightweight floating phrase, pending moving-frame contrast QC",
    noveltyScore: 0.83,
    platformFitScore: 0.86,
    firstImpactScore: 0.85,
    legibilityScore: 0.90,
    repetitionRiskScore: 0.12,
  },
];
const selected = selectBrandVisualTreatment({ platform: "tiktok", titleRequired: true, candidates, approvedPolicy });
assert.equal(selected.selected.id, "CINEMATIC_GOLD");
assert.equal(selected.selected.requiresFrameContrastQC, true);
assert.equal(selected.productionStatus, "REQUIRES_RENDER_FRAME_QC");
assert.ok(calculateContrastRatio("#FFC86B", "#071425") >= 3);
assert.throws(() => selectBrandVisualTreatment({ platform: "tiktok", titleRequired: true, candidates, approvedPolicy: {
  ...approvedPolicy, palette: { ...approvedPolicy.palette, purple: "#FFFFFF" },
} }), /differs from versioned canonical/);
assert.throws(() => selectBrandVisualTreatment({ platform: "tiktok", titleRequired: true, candidates: [{ ...candidates[0], colorToken: "pink" }, candidates[1]], approvedPolicy }), /outside the canonical group palette/);
assert.throws(() => selectBrandVisualTreatment({ platform: "tiktok", titleRequired: true, candidates: [{ ...candidates[0], fontRole: "MADE_UP" }, candidates[1]], approvedPolicy }), /not in the verified Brand/);
assert.throws(() => selectBrandVisualTreatment({ platform: "tiktok", titleRequired: true, candidates: [{ ...candidates[0], backgroundToken: "gold" }, candidates[1]], approvedPolicy }), /contrast 3:1/);
assert.equal(selectBrandVisualTreatment({ platform: "instagram", titleRequired: false, approvedPolicy, candidates: [] }).enabled, false);
const onlyAlternate = selectBrandVisualTreatment({ platform: "tiktok", titleRequired: true, candidates, approvedPolicy, recentTreatmentIds: ["CINEMATIC_GOLD"] });
assert.equal(onlyAlternate.selected.id, "CYAN_UNBOXED");
console.log("PASS: brand token lock, contrast, dynamic style, no repeated title template, no-title choice");
