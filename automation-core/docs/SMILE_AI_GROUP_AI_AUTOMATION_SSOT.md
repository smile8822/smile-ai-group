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
