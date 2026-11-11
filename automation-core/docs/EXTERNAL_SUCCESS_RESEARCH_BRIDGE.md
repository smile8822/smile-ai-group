# SMILE AI GROUP — External SNS Success Research Bridge V1

Date: 2026-11-11
Status: FEATURE_BRANCH_IMPLEMENTED / NOT PRODUCTION DEPLOYED
Owner: SMILE AI GROUP (KAIO supervises)
Base: `automation/creative-director-phase3-20261005`

## Why this exists

Our account's low-view videos are **not** the initial creative reference. First investigate truly high-performing external videos for the requested audience, content class, country, and each requested SNS. Separate observed evidence from hypotheses, paid distribution from organic audience interest, and aggregate campaign results from individual-video results. Learn the underlying mechanism; do not copy external visuals, scripts, voices, or a creator's branded assets.

## Implemented in this branch

- `src/ExternalSuccessEvidence.mjs` validates per-platform, sourced example records.
- A research case must have an HTTPS source, source-linked numerical performance metric, observation time, explicit verified flag, country, content class, paid/organic/mixed classification, and techniques with each claim's observation basis.
- Metric scope is explicit: `SINGLE_VIDEO`, `CAMPAIGN`, `CREATOR_COHORT`, or `FORMAT_CATEGORY`. The last three are never treated as a specific video's view count.
- `CASE_DESCRIPTION_ONLY` cannot support a `FRAME_OBSERVED` claim. Never infer typography, font, title location, or editing detail from a case-study description when the actual frames were not inspected.
- `CreativeDirector.createCreativeExecutionSpec` now accepts optional `externalSuccessBundle`. For requests with `requireExternalSuccessResearch: true`, missing external examples for **any requested platform** fail closed. Each platform analysis must cite its own verified `externalCaseRefs` and give a distinct `originalityStrategy`.
- Existing requests with the flag omitted remain compatible, so this feature-branch change does not silently block older workflows. The feature must be explicitly activated and verified for the intended scope.
- All external evidence is `RESEARCH_ONLY_NOT_GOLDEN`. It cannot be used to bypass owner-approved voice, character, music rights, visual SSOT, local QC or Golden Module approval.

## Creative planning contract

```js
const spec = createCreativeExecutionSpec({
  request: {
    requestId: "request-123",
    tenantId: "customer-123",
    objective: "Original local story",
    targetPlatforms: ["tiktok"],
    requireExternalSuccessResearch: true,
  },
  externalSuccessBundle: {
    reviewedAt: "2026-11-11T09:00:00Z",
    cases: [{
      id: "CASE_TIKTOK_001",
      verified: true,
      platform: "tiktok",
      country: "DE",
      contentClass: "COMMUNITY_HUMOR",
      distribution: "MIXED",
      sourceUrl: "https://ads.tiktok.com/business/en-US/inspiration/bvg-x-gud-berlin-tiktok-success-stories",
      observedAt: "2026-11-11T08:00:00Z",
      visualReviewStatus: "CASE_DESCRIPTION_ONLY",
      metrics: [{
        name: "average_play_time",
        value: 25.08,
        unit: "seconds",
        scope: "CAMPAIGN",
        sourceUrl: "https://ads.tiktok.com/business/en-US/inspiration/bvg-x-gud-berlin-tiktok-success-stories",
      }],
      techniques: [{
        dimension: "STORY",
        description: "Original hand-puppet brand character world",
        basis: "SOURCE_REPORTED",
      }],
    }],
  },
  platformAnalyses: [{
    platform: "tiktok",
    analyzedAt: "2026-11-11T09:00:00Z",
    audienceFit: "Local viewers",
    storyStrategy: "Original local field story",
    externalCaseRefs: ["CASE_TIKTOK_001"],
    originalityStrategy: "Independently produced Busan scenes and original Korean story",
  }],
  storyPlans: [/* existing platform-specific story, creative decisions and verified Golden bindings */],
});
```

The sample deliberately records what the official source reports, **not** unseen pixel-level fonts, title sizes, shot transitions, or an unverified organic view count.

## Non-negotiable order for the next integration

1. Discover relevant external cases from permitted platform sources, with source URLs, country, date, campaign/post metric scope, and rights information.
2. Verify any claimed metrics and link their source. Review actual individual video frames before recording frame-observed typography, pacing, editing, sound or title treatment.
3. Produce platform-specific original concept options. Cite benchmark IDs and describe why the creative idea is different from each external original.
4. Select title, font role, approved palette, layout and subtitle scheme with the existing Brand SSOT + Creative Ideation Engine and current **internal verified** Success Baseline. External examples influence ideas, not production permissions.
5. Render drafts, conduct human/automated QC, and measure our own controlled performance. Promote to Golden only after explicit verified real-use evidence and owner policy.

## Not implemented yet — do not claim otherwise

- No authorized live collection of individual TikTok/Instagram/YouTube/Facebook videos or their insights via API on this branch.
- No actual frame-by-frame visual review, multimodal video understanding or reliable font identification from external video files.
- No automatic ingest from the daily SNS success-research scheduled task into this runtime's `externalSuccessBundle`.
- No automatic creative candidate generation or dynamic video rendering from external case data in this change.
- No deployment, customer activation, scheduled publishing, replies, paid API calls, or new Golden success promotions.

## Verification

`cd automation-core && npm run verify`

The core, phase 2, phase 3, external evidence and Creative Director bridge checks must all pass before code review. Keep the external research feature flag disabled in normal production until a verified source adapter and visual review pathway exist.
