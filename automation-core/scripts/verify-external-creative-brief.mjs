import assert from "node:assert/strict";
import { buildExternalCreativeBrief } from "../src/ExternalCreativeBrief.mjs";

const bundle = { cases: [
  {
    id: "PUBLIC_CASE",
    platform: "tiktok",
    country: "KR",
    contentClass: "TRAVEL",
    distribution: "MIXED",
    sourceUrl: "https://ads.tiktok.com/business/en/inspiration/seibu-railway-studio15-case-study",
    metrics: [{ scope: "CAMPAIGN" }],
    techniques: [
      { dimension: "STORY", description: "Original three-episode travel story", basis: "SOURCE_REPORTED" },
      { dimension: "TYPOGRAPHY", description: "Unknown font not actually seen", basis: "HYPOTHESIS" },
    ],
  },
  {
    id: "VISUALLY_REVIEWED_CASE",
    platform: "tiktok",
    country: "DE",
    contentClass: "TRAVEL",
    distribution: "ORGANIC",
    sourceUrl: "https://www.tiktok.com/@creator/video/1234567890000000000",
    metrics: [{ scope: "SINGLE_VIDEO" }],
    techniques: [{ dimension: "LAYOUT", description: "Opening uses measured title space", basis: "FRAME_OBSERVED" }],
  },
] };
const brief = buildExternalCreativeBrief({ platform: "tiktok", bundle, desiredCountry: "KR", desiredContentClass: "TRAVEL" });
assert.equal(brief.caseCount, 2);
assert.equal(brief.status, "CREATIVE_RESEARCH_BRIEF_ONLY");
assert.equal(brief.insights[0].basis, "SOURCE_REPORTED");
assert.equal(brief.insights[0].visualDetailVerified, false);
assert.equal(brief.insights[1].visualDetailVerified, true);
assert.equal(brief.hypotheses.length, 1);
assert.equal(brief.hypotheses[0].visualDetailVerified, false);
assert.equal(brief.insights[0].causalEffectProven, false);
assert.equal(brief.insights[0].copyingPermitted, false);
assert.equal(brief.noReuseOfExternalMedia, true);
assert.equal(buildExternalCreativeBrief({ platform: "facebook", bundle }).caseCount, 0);
assert.equal(buildExternalCreativeBrief({ platform: "tiktok", bundle: null }), null);
console.log("PASS: external creative brief distinguishes observed, reported and hypothetical patterns");
