# SMILE AI GROUP — Research-first creative planning, Phase 3

## Purpose and honest status

The new **opt-in** `createResearchDrivenCreativePlan()` path joins Phase 1's verified external-success evidence, Phase 2's timestamped direct-video review, Phase 3's existing independent creative-idea/title selectors, and verified group-brand visual constraints before any production begins.

**Status: PLANNING GATE ONLY.** No successful live SNS discovery, viewing or frame audit, model-produced creative candidates, rendered video, social publication, comment automation, or production integration is claimed by this branch. Test references use synthetic fixtures under `example.org` solely to verify fail-closed behavior. Do **not** enter these fixtures as real research results.

## Required production inputs

1. A request containing tenant, objective and **explicit** target SNS platforms only.
2. An independently collected and human/video-model **directly reviewed** external success case **for each requested platform**, with authenticated access where required, timestamped frame observations, first-party URLs, performance metrics and metric scope, and paid/organic status. A public view count by itself is not a frame review or proven reason for performance.
3. Candidate original ideas, platform-local scripts and at least two title and visual-treatment alternatives **when a title is creatively necessary**. Title-off stories intentionally have no visual-title alternatives. Each selected idea/title must cite an evidenced case from its own platform; references are *inspiration*, never instructions to duplicate.
4. A brand policy obtained through trusted configuration from the latest approved GitHub SSOT and Golden methods, not a free-form creative model suggestion. The selector verifies the exact versioned canonical group palette and SSOT path, and independently allows only **policy-supplied approved** font roles, title-box modes, measured-width modes and size strategies. The approved font-role identifier in synthetic tests is only a fixture, **not evidence that social font assets are registered**.
5. Real Golden module IDs/versions/baselines, verified by the production-side registry before render. The test module IDs are synthetic placeholders and do **not** authorize production.

## Safety and original creative selection

- Existing `selectCreativeIdea()` evaluates originality, first impact, audience/platform fit, feasibility, truth and repetition.
- Existing `selectCreativeTitle()` independently evaluates wording, curiosity, comprehensibility, truth, clickbait and recent repetition. **No compulsory giant title.**
- New `selectBrandVisualTreatment()` evaluates multiple proposed layout/style treatments against canonical parent-brand colors (Smile Gold, Purple, AI Blue, Future Cyan, Deep Navy, On Dark), approved font/method allowlists, measured width and minimum static large-type contrast. It avoids exact recent treatment IDs; longer-term semantic/style diversity still requires upstream analysis.
- Moving footage, small text, crop-safe zones, font licensing, logo/master identity, native-language legibility and actual render frames all require separate visual QA. The code does **not** pretend contrast on a video frame was tested.
- Each platform's chosen package is built into `createCreativeExecutionSpec()` with a validated external benchmark and original strategy, no unrequested-platform expansion.
- `productionPermission: false` and `publicationPermission: false` are hard-stopped pending approved Golden asset resolve, rendering QA, verified platform settings, content rights, and an explicit owner-approved publish step. No external SNS API call occurs here.

## Source of truth

- Canonical machine SSOT: [`smile-ai-group/smile-ai-group/config/group-brand-design.json`](https://github.com/smile-ai-group/smile-ai-group/blob/automation/smile-ai-group-guardrails/config/group-brand-design.json), particularly `assetIdentity.group.palette`, `typography.fontFamily.ui`, `governance.brandAssetLock` and `assetIdentity.group.requiredAssets`.
- Canonical human SSOT: [`docs/design/BRAND_DESIGN_SSOT.md`](https://github.com/smile-ai-group/smile-ai-group/blob/automation/smile-ai-group-guardrails/docs/design/BRAND_DESIGN_SSOT.md).
- The official group logo is **3D City-Door Master**, not any historical group mark. Do not synthesize substitute logos.
- Parent-brand palette is a **versioned checked mirror** of upstream JSON; when the SSOT changes, update and test this mirror. No social platform or LLM may arbitrarily introduce a new palette token.
- UI font stack documented by upstream: `Inter, Pretendard, Noto Sans KR, system-ui, sans-serif`. This is not by itself approval for redistribution in a rendered video; downstream must validate font licenses and social-specific typography roles.

## Next necessary engineering stages

1. Use approved official tokens for YouTube Data API and authenticated TikTok/Meta discovery where legally and technically supported; for each platform, record real direct-video frame review and verified provenance.
2. Add verified search-trend/current-news input with country-language provenance, then a generative model adapter for **candidate** stories/scripts/titles without introducing unverified success claims.
3. Compare actual complete creative output against verified Golden modules. Inspect rendered frames on a representative sampling of foreground/background, Korean and 4 other languages, text outlines, word wrapping, title/caption safe zones, first impact, music rights, and identity assets.
4. Only after explicit approval use publisher connectors for each platform's native metadata, location/tag availability, language and privacy choices; then add platform-permitted comment/DM drafting and reply flows with moderation and audit trail. A like is an interaction signal, not generally a replyable message.

## Verification

`npm run verify` executes all existing checks plus `verify-brand-visual-treatment.mjs` and `verify-research-driven-orchestrator.mjs`. These are synthetic-unit/integration checks. Passing tests **does not** certify that live video research, paid/organic verification or a customer-facing product has been delivered.
