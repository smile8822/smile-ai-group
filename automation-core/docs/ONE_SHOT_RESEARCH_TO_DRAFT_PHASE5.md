# Phase 5 — One-shot external research → original creative proposals → independent review → locale-specific SNS drafts

## Honest implementation status

`src/OneShotResearchToDraft.mjs` exposes an asynchronous, **provider-injected, pre-production orchestration contract**. It does not contain or claim a live AI API key, real SNS content access, verified third-party image/video viewing, video rendering, published posts, live viewer engagement, or a deployed customer UI. Every test's view count/video observation and model response is an explicitly **synthetic fixture**, not real research. Actual one-shot automation requires authorized provider implementations and independent verification before use.

The contract connects:

1. A trusted research provider `collectReviewedEvidence()` (or separately supplied trusted evidence), followed by `validateExternalSuccessBundle(required:true,requireDirectVideoReview:true)` for **every requested** social platform; there is **no scraping or simulated frame-review fallback**.
2. An AI creative generator `propose()` receiving the verified source IDs and `buildExternalCreativeBrief()` mechanisms **before** original scenes, hooks, optional titles and visual treatments are proposed. Externally observed mechanisms are inspiration, never a license to copy media.
3. An **independent** candidate reviewer `review()` with separate identity and numeric evaluation covering truth safety, first impression, novelty, relevance, platform fit and repetition. All generator-supplied candidate scores are overwritten with review scores. Reviewer scores remain predictive judgments, **not proven causes of views**; real provider identity and evaluation quality require server-side enforcement.
4. `createResearchDrivenCreativePlan()` applies independently reviewed candidate scores, per-platform source references, the canonical group palette and font/method allowlists, and existing Golden module binding requirements. Genuine Golden registry lookups must happen outside this module; **never take Golden IDs from the model**.
5. A localization provider `compose()` receiving the selected story and explicit target locale/account. Its suggested trend tags must match a **trusted, independently verified** trend allowlist; self-asserted trend dates, location evidence, account privacy and company relevance are rejected. Account privacy, verified scene location and script-reviewed company relevance may only come from the trusted host-side inputs.
6. `createPlatformPublishingDraftPackage()` enforces independent per-SNS titles/text, authorized hashtag categories/order, account-local privacy fields, language scope and uncompromised publication holds.

## Company hashtag rule — updated by the owner on 2026-11-11

- **Unrelated videos must contain zero company hashtags.** Example: Bukangi, Busan tourism, concerts, market scenes, general local news and other original-interest videos not about SMILE AI GROUP or its products. A watermark/company account identity alone is insufficient.
- Company hashtags are allowed **only if the subject genuinely features** the relevant company/service, after a reviewed-script entry with `reviewerId`, `evidenceRef`, and the particular `featuredBrandTags`. Maximum two, always last.
- `#CORE` only when CORE is in the story. `#MISO` only when MISO is the actual topic; group tags only when the company itself is relevant. Even after a script review, final rendered-media review remains mandatory.
- The creative model cannot fabricate its own `brandRelevance`, `location`, `creatorInfoVerified`, `creatorPrivacyOptions`, or `privacyChoice`. No uncertain trend tag is turned into an apparently verified trend by the model.

## Explicit target contract

`targets = [{id,platform,language,channelKey}, ...]` selects only user-approved combinations, including two languages on the **same TikTok account**, never duplicate same-language posts or automatic expansion to unrelated accounts/countries.

Output: `ONE_SHOT_AI_CREATIVE_AND_METADATA_DRAFTS_READY_NOT_PUBLISHED`, `productionPermission:false`, `publicationPermission:false`, plus the separately validated `creativePlan` and `publicationDrafts` for audit. Rendering, music/video/voice rights, full native-language QC, brand assets, public claim checking, official platform/API connection, metadata field/geo mapping, user privacy settings, owner approval and publication are **not** performed by this route.

## Source-trust and infrastructure limits

- A caller may inject a research provider **only through trusted server configuration**, not from a customer request or a generator's response. The integration still must audit that a returned `frameAudit` came from actual authorized playback/inspection, not a forged JSON object. Schema validation alone cannot prove a video was really viewed.
- The independent evaluator must be a distinct, audited provider in deployment; string IDs merely test the contract and cannot prove independence.
- `brandVisualPolicy`, Golden bindings, native-platform account state, verified trends, and location evidence must originate from versioned/authorized registries. `creatorInfoVerified:true` is not itself an authenticated TikTok API response.
- User-specific media/voice and analytics must not be submitted to external model providers without suitable privacy, retention, rights and consent controls.
- Existing low-view SMILE AI GROUP videos are never the initial creative baseline. External high-performing examples require metrics provenance and direct video reviews; paid/campaign aggregate results are not falsely treated as organic single-video wins.

## Tests and deployment status

`node scripts/verify-one-shot-research-to-draft.mjs` verifies fail-closed provider sequencing, synthetic verified source review, AI score replacement, per-SNS original content, KO/ID same-account TikTok scope, no company tags on unrelated videos, rejection of forged brand/location/privacy/trend fields, and no external publication. `npm run verify` runs this and all previous checks. **No production merge or deployment is authorized by these tests.**
