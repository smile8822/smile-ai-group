# Phase 4 — Platform-specific SNS publication drafts (not live publishing)

## Status

**Implemented only as a publication-draft and preflight-check module**: `src/PlatformPublishingDraft.mjs`. No social account credentials are available in the current environment; this change cannot publish, schedule, retrieve comments, or reply to followers. **No new live customer-facing capability or real-world content success is claimed.**

Entry point: `createPlatformPublishingDraftPackage({creativePlan,targets,draftInputs,checkedAt,platformLocationCapabilities})`.

## Inputs and scope

1. Takes the Phase 3 research-first validated plan, whose `productionPermission` and `publicationPermission` must both be `false`.
2. Requires an **explicit target list**, each with `id`, `platform` (`tiktok`, `instagram`, `youtube`, `facebook`), `language` (`ko`, `id`, `en`, `zh`, `ja`) and an opaque `channelKey`. Does not auto-expand accounts, countries or platforms. Multiple languages **may intentionally share the same TikTok account** but cannot repeat a same-language draft for that account.
3. Requires one original, independently written metadata title and main post text for each target; identical same-language copy across different SNS is rejected.
4. Requires typed hashtag categories: `topic`, `region`, `trend`, and `brand`. Outputs them **in exactly that order**; the company tags are always at the end, maximum two, using the approved brand tag vocabulary. `#CORE` is prohibited unless the subject is genuinely CORE-related. A trend tag requires a verified HTTPS source and an observed timestamp within 24 hours of the package's `checkedAt`. The post body cannot smuggle unverified extra hashtags.
5. A location tag may only be requested when the *recorded scene itself* has verified place evidence. Because platform-specific geotag ID and permissions have not been verified, the native geotag is **not applied automatically**; a manual platform review is required.

## Platform fields and privacy

| Platform | Draft adaptation | Platform-specific safeguard |
| --- | --- | --- |
| TikTok | Combines platform-specific body plus ordered hashtags as TikTok caption (`post_info.title` semantics), checks 2,200 UTF-16 code units | Must supply a privacy choice from the user's **current verified** `creator_info` options; never guess public mode or commenting/duet/stitch permissions |
| Instagram Reels | Distinct caption and provisional editorial headline | Actual container/publishing field support, account type, geotag and crop/cover behavior require authenticated adapter review |
| YouTube Shorts | Distinct metadata title, description, default language, keyword tags and explicit privacy status | Checks 100-character title, 5,000-byte UTF-8 description and 500-character keyword budget; defaults and scheduling never assumed |
| Facebook Reels | Distinct caption and provisional editorial headline | Page publishing permissions and API field mapping remain unverified without authorized account access |

No platform adapter calls are made. An LLM or operator supplying `creatorInfoVerified:true` does not constitute TikTok authentication; the real publishing layer must retrieve account data from the official API and verify its provenance independently.

## Additional non-negotiable SSOT rules

- All brand images, official logos, approved Golden audio and dynamic video-title typography are resolved in other production modules. This module adds metadata only and **does not** fabricate or update images, video, title card pixels or approved font assets.
- Language-specific titles/captions require native review and text safety QC. This module cannot guarantee that translated text is natural or truthful solely from its language label.
- Historic weak-performing SMILE AI GROUP posts must never be the sole creative reference. Verified third-party examples and direct frame observations are required upstream.
- No claim that a hashtag, particular length, trending audio or geotag is known to **cause** high views; such outcomes must be measured as experiments.
- The returned drafts have `approvedToPublish:false`, package `productionPermission:false`, `publicationPermission:false`, and explicit unresolved QA flags.
- Posts to TikTok, Instagram, YouTube, Facebook must pass native account/permissions, rights, latest-platform constraint checks and owner approval independently. Comments/DM replies are a **separate later module** with explicit moderation and audit.

## Primary API references checked on 2026-11-11

- [TikTok Direct Post](https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post): current `creator_info` privacy options and caption length constraints.
- [YouTube videos resource](https://developers.google.com/youtube/data/reference/rest/v3/videos): title, description, tags, default language, privacy restrictions.
- [YouTube minimum functionality](https://developers.google.com/youtube/terms/required-minimum-functionality): platform choice and required user-editable metadata/privacy controls.
- [Meta official Instagram Postman collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api): Instagram professional publishing and Reels container steps.

Test: `node scripts/verify-platform-publishing-draft.mjs` (synthetic fixtures only). Full suite: `npm run verify`.
