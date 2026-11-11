# SMILE AI GROUP — External Success Discovery & Visual Research Phase 2

Date: 2026-11-11
Status: TESTED FEATURE BRANCH / NOT LIVE COLLECTING / NOT DEPLOYED
Parent feature: `automation/external-success-intelligence-20261111`

## Goal

Discover successful **external** short-video candidates first. Research what is actually seen and what available metrics establish; distinguish hypotheses from evidence. Then feed each requested platform's distinct original creative planning. The company's low-view posts are only a **post-production comparison**, never the initial creative benchmark.

## Platform access and exact limitations

| Platform | Currently official route | Access limitation | Automation status |
| --- | --- | --- | --- |
| YouTube | Data API `search.list` + `videos.list` for public videos and views | A Google project / enabled API / authorized API key; quota. `videoDuration=short` is **under 4 minutes**, not a Shorts confirmation; aspect ratio & actual Shorts classification need further verification | Implemented discovery adapter; mocked API tests passed; not live-tested without credentials |
| TikTok | Creative Center Top Ads, official cases, Trends | Top Ads is an **ad** benchmark; logged-out dashboard shows only a limited sample. TikTok Research Tools are intended for approved independent/non-profit research; do not repurpose them as commercial access | Curation and verified research-bundle import only; no authorized programmatic Top Ads feed |
| Instagram | Official Meta Graph API, professional account metadata / Business Discovery where approved | Access token, business permissions and review; owned-media insights cannot be treated as competitor insights | Research-bundle import only; no credentialed competitor adapter |
| Facebook | Meta Graph API / approved public Page access and owned Page insights | Public Page data and insights have different permissions; never assume access to others' private engagement/retention | Research-bundle import only; no credentialed competitor adapter |

Official references:

- YouTube search: https://developers.google.com/youtube/data/reference/rest/v3/search/list
- YouTube video details: https://developers.google.com/youtube/data/reference/rest/v3/videos/list
- Shorts requirements: https://support.google.com/youtube/answer/15424877
- TikTok Top Ads: https://ads.tiktok.com/resources/help/article/how-to-use-the-top-ads-dashboard
- TikTok commercial content access: https://developers.tiktok.com/docs/en/commercial-content-api-getting-started
- Instagram official API collection (Meta): https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api

## Implemented code

1. `src/YoutubeCandidateDiscovery.mjs`
   - Performs official public-video search sorted by view count, then fetches `snippet`, `contentDetails` and public `statistics`.
   - Filters duration over 180 seconds but still labels every result **UNVERIFIED_SHORTS_CANDIDATE**. Vertical aspect/Shorts feed identity are not certified by this API.
   - Captures public views/likes/comments, published time, source URL and per-day view-velocity **research heuristic**. Views do not establish watch time, retention, paid vs organic or a causal mechanism.
   - Returns the discovery region as **video availability**, not audience nationality. No external media is copied.
   - Expects an authorized API key from its caller; key is never embedded in source code or error text. It performs no request unless invoked.
2. `src/ExternalSuccessEvidence.mjs`
   - `FRAMES_REVIEWED` now requires timestamped observations with reviewer identity, review method, source-video URL and visual summary.
   - A frame-observed typography, layout, camera or other detail needs an audit record for the same dimension.
   - Supports `requireDirectVideoReview: true` to block creative planning unless every requested platform has directly reviewed examples. This gate is opt-in until source-review workflow is truly ready.
3. `src/ExternalCreativeBrief.mjs`
   - Transforms verified external case techniques into per-platform provenance-tagged insights and hypotheses without copying designs.
   - Distinguishes a **frame-observed visual** from a **source-reported narrative** and **a hypothesis**. Metrics keep paid/organic classification and single-post/campaign scope.
   - Exposes research mechanism and country/content relevance, not a mandatory title, font, layout or new approved Golden method.
4. `src/CreativeDirector.mjs`
   - Includes `externalCreativeBrief` in each platform's story specification.
   - Optional `requireDirectVideoReview` gate plus the existing `requireExternalSuccessResearch` flag. No change to default production execution.

## Workflow contract

```text
official public discovery / authorized source / human research
→ candidate (no proof of high retention or Shorts identity)
→ metrics + source verification (paid/organic/campaign/post split)
→ direct video review with timestamps where authorized
→ sourced case record (RESEARCH_ONLY_NOT_GOLDEN)
→ platform-specific ExternalCreativeBrief
→ original Creative Director concept and title candidates
→ Group Brand SSOT + approved Golden production techniques
→ draft + QC → controlled own-data experiment → separate Golden promotion decision
```

## Recommended next engineering phase (NOT YET BUILT)

- Securely configure authorized YouTube Data API credentials and run a small, quota-bounded **live** discovery test. Do not store credentials in Git, issue comments or chat.
- Implement actual legally permissible visual observation of source videos, including second-level hook/text/scene data; third-party assets remain observation-only and are never recycled in customer videos.
- Obtain required TikTok/Meta access approvals or use legally sourced official curated cases as clearly documented manual research; **no scraping around permissions**.
- Bind the existing daily external SNS research report to the audited case bundle, then generate and QC original creative proposals per requested platform/language.
- Validate channel-level bias, topic relevance, time since upload, promotion and metric definitions before calling any idea a real verified winner.

## Verification

`cd automation-core && npm run verify` runs existing and Phase 2 regression tests. All source adapter tests use a stubbed fetch response, so a test PASS does **not** represent a live Google API connection, actual video viewing or deployment.
