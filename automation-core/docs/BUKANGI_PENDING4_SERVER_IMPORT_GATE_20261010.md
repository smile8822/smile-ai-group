# Bukangi TikTok LIVE — Remaining four MASTER import gate

Date: 2026-10-10
Owner: SMILE AI GROUP AI Automation Core, not MISO.
State: MANIFEST_VALIDATED / IMPORT_NOT_EXECUTED / FULL_QC_NOT_EXECUTED.

## Four immutable original sources

Use the existing canonical manifest at automation-core/manifests/bukangi-tiktok-live-2026-10-05.json.
Only goldStatus = PENDING_GROUP_CORE_ANALYSIS should be selected. Do not create a second master registry.

| Date and time KST | Drive file ID | Size bytes | Duration |
| --- | --- | ---: | --- |
| 2026-10-01 17:07 | 1xN0eDHGcjWBscNOq13PBL_duujEtrDcj | 837,276,607 | 61:31 |
| 2026-10-02 14:05 | 18fey6JT2DxICxjUjeM1tou-Fbka-vRKR | 561,251,629 | 26:35 |
| 2026-10-02 15:19 | 1ezEWeBFWxYV3iaXB13lYBMpDq_Slm4nr | 872,279,796 | 80:35 |
| 2026-10-03 17:16 | 1TfcFZu-281lRkN9RLyM7X5KV-uSrtGrB | 932,683,689 | 55:14 |

Total: 3,203,491,721 bytes. Preserve all eight original registrations and the 15 previously approved GOLD clips of the other four recordings.

## Group-owned storage policy

- Google Drive is the original import source.
- Put immutable original MP4 bytes only in the existing PRIVATE SMILE AI GROUP S3-compatible object storage.
- Keep checksum, provenance, source timecode, privacy, usage rights, quality and approval metadata in the group asset registry; never upload original MP4 to Git.
- MISO consumes group-approved assets. The active DigitalOcean miso-private-staging droplet is not proof of group-owned object storage.
- No public publishing or new GOLD status without QC.

## Execution on an authorized group runtime

Run from the automation-core directory only AFTER validating private bucket ownership, free capacity, network/permissions, Google Drive authorization and configured secrets.

    node scripts/verify-bukangi-pending4.mjs --check-env
    node scripts/import-google-drive-large-media.mjs --manifest manifests/bukangi-tiktok-live-2026-10-05.json --only-pending

The first command is read-only and checks exact 4-of-8 source identity/size and environment variable PRESENCE only, not access or connectivity. It never prints secret values.

Credentials are supplied exclusively through the server secret manager:
SMILE_AI_AUTOMATION_GOOGLE_DRIVE_ACCESS_TOKEN, SMILE_AI_AUTOMATION_BUCKET,
SMILE_AI_AUTOMATION_REGION, SMILE_AI_AUTOMATION_ACCESS_KEY_ID,
SMILE_AI_AUTOMATION_SECRET_ACCESS_KEY, and optional SMILE_AI_AUTOMATION_S3_ENDPOINT.

The existing importer uses Drive byte-range reads, resumable multipart object writes and checkpoints. The ChatGPT Google Drive connector's per-file 256 MiB limit cannot ingest these four files.

## Strict verification after import

1. Confirm private object, original byte length and end-to-end SOURCE versus OBJECT cryptographic checksum. Multipart S3 ETag is not a full-file MD5. Existing MASTER_STORED means stored, not fully MASTER_VERIFIED.
2. Run full-stream ffprobe / audio-video decode and build non-destructive timecoded proxies.
3. Score scenes for visible actual shark, sharpness, steadiness, composition, obscuration, duplication and rights.
4. Only visual+decode-QC passing segments become GOLD. Retain all rejects as MASTER-only, not reusable clips.
5. Register exact source/timecodes, derived checksum and approval, preserving untouched MASTER.
6. Advance operational status only after evidence exists for every one of the four files.

## Evidence at this handoff

Drive sources and metadata located; group-owned importer and existing 8-master manifest confirmed. No actual group-private bucket connection, live server shell/import command, checksum comparison, full-video decode/visual QC or GOLD promotion has been verified in this chat. This document must not be mistaken for completed migration.
