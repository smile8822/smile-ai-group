# SMILE AI GROUP AI Automation Service SSOT

Date: 2026-10-05

## Ownership

The customer-facing AI automation service is owned and provided by **SMILE AI GROUP**.

Customer entry:

```text
Member
→ SMILE PAY (SP)
→ SP Usage
→ AI Automation Service
→ Request result
```

MISO is **not** the owner of this customer service.

MISO uses this group-level automation core only when producing MISO service assets such as MISO guide videos, MISO promotional videos, MISO character/voice content, or other MISO-owned media.

## Customer contract

Customers may provide:

- one or more videos, including long LIVE recordings;
- hundreds or thousands of photos;
- audio files;
- customer-owned characters, voices, brands, products, or logos;
- approved SMILE AI GROUP shared assets;
- any combination of the above that is supported by the service.

Customers describe the desired result. They do not select internal tools, split large files, retry provider calls, or perform internal QC.

## Company contract

SMILE AI GROUP absorbs the complexity:

```text
request understanding
→ input classification
→ asset discovery
→ approved Golden Module search
→ module composition
→ execution-plan lock
→ durable job execution
→ checkpoint recovery
→ QC
→ delivery / publishing
```

The company repeatedly experiments internally. Only successful, verified modules and pipelines may enter the Golden Registry. Failed experiments, failed artifacts, and unverified routes are not reusable customer production paths.

## Assetization

Large source media is not treated as "a file to cut into smaller files." It is converted into a searchable asset library.

```text
SOURCE
→ immutable MASTER
→ proxy / analysis derivative
→ scene index
→ semantic + quality scoring
→ bad-scene rejection
→ GOLD candidate
→ visual QC
→ decode QC
→ GOLD asset registry
```

Bad scenes remain traceable inside MASTER but never become reusable GOLD assets.

Typical rejection reasons:

- severe shake or accidental fast camera movement;
- blocked view;
- severe focus or exposure failure;
- accidental floor/ceiling/phone-handling footage;
- corrupt frames;
- repeated or near-duplicate scene when a better approved scene exists;
- low editorial usefulness.

## Large-media transport

Customer large files use direct resumable multipart upload to private company object storage.

Remote imports such as Google Drive use server-side byte-range reads and multipart object-storage writes.

The application server must never require an entire multi-gigabyte source in memory.

## Shared core vs service-specific assets

**SMILE AI GROUP AI Automation Core owns:**

- intake and upload;
- object storage;
- asset lineage;
- proxy generation;
- scene indexing;
- quality scoring;
- GOLD promotion;
- Golden Module Registry;
- pipeline composition;
- durable jobs and checkpoints;
- generic QC;
- delivery and publishing orchestration.

**MISO owns only MISO-specific items:**

- MISO character identity;
- MISO Voice Master;
- MISO titles/subtitles/layout rules;
- MISO service scripts;
- MISO guide/promotional recipes;
- MISO-specific brand QC.

Other SMILE AI GROUP services may use the same core with their own service-specific assets and rules.

## Non-negotiable rules

1. Customer manual splitting is not part of the normal product path.
2. Customer does not choose internal providers or retry steps.
3. MASTER is immutable.
4. Only QC-passed assets become GOLD.
5. Every GOLD asset is traceable to source MASTER and timecode.
6. Only successful verified modules enter the Golden Registry.
7. Execution is idempotent and checkpointed.
8. Service-specific assets never redefine ownership of the group automation core.


## Creative Director and fresh-context story planning

SMILE AI GROUP owns the central **AI Creative Director / Golden Pipeline Orchestrator** for customer automation.

For each member request, the system must determine whether the result depends on current facts, latest news, market conditions, local information, or current social-platform behavior. When freshness matters, the request is not allowed to proceed from model memory or an old script alone.

The planning sequence is:

```text
member request
→ full intent / audience / country / language / platform analysis
→ latest news / latest information research when relevant
→ claim and fact verification
→ per-platform social analysis
→ per-platform story creation
→ explicit creative decisions
→ current verified Success Baseline resolution
→ Golden Module composition
→ execution-plan lock
→ production
→ QC against the current success baseline
→ delivery / publishing
```

### Per-platform story rule

TikTok, Instagram, YouTube and Facebook are analyzed separately.

A single generic script translated or reordered across all social platforms is not the default production model. Each target platform receives its own hook, story beats, duration, information density, CTA, title treatment, subtitle treatment and publishing-oriented visual structure according to the member's request and current platform evidence.

### Explicit creative decisions

The Creative Director must explicitly decide, rather than blindly applying one template:

- whether a title is useful;
- title wording, font role, size strategy, color / accent strategy;
- whether a title or topic container is useful;
- whether the container uses measured auto-width, full band, no box, or another verified pattern;
- whether subtitles are required;
- subtitle language, size, timing and active-word / phrase behavior;
- whether narration / voice is required;
- whether music is required and its role relative to speech / original audio;
- scene labels, transitions, thumbnail / cover and CTA;
- story structure and scene ordering.

Every technique actually used in production must be backed by a verified Golden Module and the current matching Success Baseline.

### Latest-success baseline policy

Success is scoped by content type, capability, platform, language, country and service scope.

A new method, font treatment, title layout, subtitle method, story pattern, voice treatment, music treatment, render method or QC method does **not** become customer production merely because it is newer.

Promotion requires:

```text
internal experiment
→ successful render / execution
→ QC PASS
→ real-use success evidence
→ side-by-side / benchmark comparison with the current baseline
→ verified promotion
```

If the candidate is better and verified, it becomes the new ACTIVE Success Baseline for that exact scope. The previous baseline is marked SUPERSEDED for that scope and remains auditable. A previous method may remain ACTIVE in another scope where it is still the better verified choice.

Failed, unverified, merely experimental, or quality-regressed methods never become customer production paths.

### Fresh research evidence

Requests that depend on latest news, current information or current trends require a verified research bundle with source references and timestamps. Evidence freshness is part of the execution contract. Stale evidence blocks the fresh-context request rather than silently falling back to an old story.

### Character and voice rights boundary

Customer production may use only customer-owned / customer-licensed assets or assets explicitly provisioned for customer use.

SMILE AI GROUP internal characters, internal voices and service identities are never exposed as customer-selectable assets.

MISO character / MISO Voice Master are used only for MISO-owned media or another explicitly authorized internal SMILE AI GROUP workflow. MISO remains a consumer of the group automation core, not the owner of customer automation.


### Requested-platform-only execution

The member's requested platform set is authoritative.

Examples:

- YouTube only → analyze, script, produce, QC and publish YouTube only.
- TikTok only → analyze, script, produce, QC and publish TikTok only.
- Instagram + TikTok → produce exactly those two only.
- All supported SNS → only when the member explicitly requests all supported SNS.

The automation must never expand a request to additional platforms merely because the source asset could be reused there.

For every job:

```text
requestedPlatforms
= analyzedPlatforms
= storyPlannedPlatforms
= productionPlatforms
= QCPlatforms
= publishPlatforms
```

Any unrequested platform analysis, story plan, render, upload, schedule or publish action is forbidden.

The system may suggest that another platform could be useful, but it must not create or publish that additional deliverable unless the member explicitly adds it to the request.
