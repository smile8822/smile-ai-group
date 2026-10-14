# SMILE CAPTURE — daily camera-to-server pilot (2026-10-14)

Status: **TESTED LOCALLY; NOT DEPLOYED**. This is a separate pilot, not a replacement for MISO or KAIO production infrastructure. Existing GOLD assets and SNS bookings must not be touched.

## What is implemented

- A self-hosted, authenticated HTTP ingest receiver for incremental mobile camera uploads.
- A mobile HTTPS browser UI using `getUserMedia` / `MediaRecorder` with a nominal 20-second chunk interval.
- The browser **persists each chunk to IndexedDB before attempting transfer**, then retries the oldest pending chunk on reconnection or manually.
- Receiver verifies each chunk with SHA-256, prevents conflicting rewrites, writes atomically, and keeps a durable manifest per session.
- Offline `assemble.mjs` validates all segment hashes and concatenates the original MediaRecorder byte stream without transcoding. Run `ffprobe` / decode QC before any publishing.
- A new capture session is independent of unfinished historical sources. Failures in 2026-10-11 Drive import must not block daily capture.

## Local smoke test

Requires Node.js >=20. No NPM packages, external API tokens, or GitHub secrets needed.

```bash
npm test
CAPTURE_ROOT="$PWD/var" CAPTURE_TOKEN="$(openssl rand -hex 32)" npm start
```

The token must be retained **privately** and entered into the browser page. For a phone, terminate TLS with a trusted HTTPS reverse proxy; camera APIs won't work on a plain remote HTTP origin. Bind backend to loopback (`127.0.0.1`) behind an authenticated reverse proxy. Never put the token into a URL or repository. For development only, localhost works without HTTPS.

**Important:** This proof of concept writes uploads to the server's local disk. It is **not** scalable customer storage and must not be deployed to the existing 80 GB MISO staging disk as a high-volume service. Production should use private company object storage, per-account authorization, short-lived tokens, per-tenant quotas, virus scanning, metrics, and a separately scalable encoding/QC worker.

## Verify on an Android phone (staging)

1. Deploy this pilot to a dedicated HTTPS test hostname with its own disk and strict authentication; don't modify production listeners or 10/11 partial cache.
2. Open the capture page in Chrome, enter token, grant camera and microphone, select **촬영 · 전송 시작**. Keep screen unlocked and browser foregrounded.
3. Record >=60 seconds; check the authenticated session manifest reports at least two fragments and non-zero `bytesReceived`.
4. Turn off network, keep recording, turn it back on and press **대기 영상 재전송**. Confirm duplicate uploads are idempotent and no part lost.
5. Stop recording; check `UPLOAD_FINISHED`, assemble and verify the resulting media using `ffprobe` and a full decode test. Do not mark QC passed from checksum-only results.
6. Independently verify that an older stuck job and a new daily session can coexist; test network errors and process restart.

The browser has constraints: Android lock-screen, OS background suspension, unexpected browser closure, battery optimizations, and IndexedDB quota can stop or lose recording. This is **not** a native background recorder or a guaranteed simultaneous recording hook into the TikTok app. Request browser persistent storage and improve on-device fallback before relying on it for live events.

## TikTok LIVE capture options (not implemented in this pilot)

1. **External encoder authorized by TikTok:** PRISM/OBS can send media to a privately secured RTMP/SRT ingest (e.g. MediaMTX), which records independent short fMP4 segments. Only if the TikTok account/platform provides an authorized stream destination/encoder capability should a properly configured relay also forward to TikTok. Keep ingestion and TikTok publishing separate.
2. **TikTok app-only LIVE:** The TikTok app's camera feed is not available to this web pilot; use a second camera/device feeding SMILE CAPTURE (matching clocks) or import an authorized LIVE replay later. Do not assume that a background web page can share the camera reliably with TikTok.

**Do not open an unauthenticated RTMP port publicly.** Live ingest needs a separate hardened server, credentials, TLS where possible, rate limits and record retention. The separate MediaMTX integration and onward TikTok relay require account permission checks and a supervised device test.

## Next integration steps

- Replace disk spool with signed, resumable transfers to SMILE AI GROUP private object storage; preserve SHA256 source lineage.
- Feed verified segments to proxy/QC workers **independently per session**; no failure in historical Drive sources may stop same-day jobs.
- Add KAIO scheduler job kinds `SAME_DAY_CAPTURE` (high priority) and `ARCHIVE_REPAIR` (separate low-priority queue), dead-letter, checkpoint, alerts.
- Integrate LIVE ingest/RTMP only after platform eligibility check and hardware live test.
- Require human review for recognizable children or other protected content before public distribution.

## 2026-10-14 staged reliability improvements (V2)

**Transport integrity:** The receiver now requires `expectedChunks` in the finalization request. A missing last or middle fragment cannot be silently treated as complete. Repeated finalization uses the same count idempotently. Hash and file-size validation remain mandatory.

**Browser offline spool:** IndexedDB V2 stores per-session metadata separately from chunk blobs. A lost connection or a failed historical segment no longer blocks all later sessions. Upload retry runs on reconnection, after new parts, periodically, and by button. The browser only asks the server to finalize after its own number of persisted parts has been successfully transferred. Browser crashes or missing local chunks **are not automatically declared complete**. The recording page still must remain in the foreground for reliable camera capture; true background recording requires a separate native mobile application.

**Daily work isolation:** New `jobs.mjs` creates independent `SAME_DAY_CAPTURE` and `ARCHIVE_REPAIR` queues. Each completed daily source is registered for downstream QC; queue records have `qcStatus: NOT_VERIFIED` and `publishAllowed: false`. Startup reconciliation repairs a crash between source finalization and queue registration; claimed jobs are not duplicated. **This is queue plumbing, not an operating KAIO video editor or a publishing service.** Worker deployment, job leases/stale job reaping, FFmpeg media QC and KAIO integration remain necessary.

**Verification:** Six Node automated tests are passing, including 120 sequential media fragments while an older recording remains stalled and required end-count integrity. The local Chromium camera E2E attempt was blocked by the execution environment's administrator policy (`ERR_BLOCKED_BY_ADMINISTRATOR` when visiting localhost). **No real Android, HTTPS remote endpoint, prolonged full-quality recording, network dropout field test, or TikTok simultaneous stream test has passed yet.**

**Deployment gate:** Do not point this disk-backed proof-of-concept at the existing 80-GB MISO staging server for sustained footage. A dedicated HTTPS staging host, private object storage, rate limits, real health/space monitoring and a media processing worker must be provisioned and validated before internal daily use. The code/PR do not change the existing 10/11 Drive original, cache, previously approved media or booked SNS posts.

Run checks:

```bash
node --check server.mjs
node --check jobs.mjs
node --check assemble.mjs
node --check public/capture.js
npm test
```

## Optional technical media QC worker

`qc-worker.mjs` consumes only the `SAME_DAY_CAPTURE` queue, assembles uploaded segments, requires video and audio streams, executes `ffprobe` and full `ffmpeg` decode, then writes a technical QC receipt. Its output always has `publishAllowed: false`. An editorial review and KAIO scheduling/publishing worker are **still unimplemented**. Install FFmpeg and run on a separate media-processing worker after establishing private storage:

```bash
CAPTURE_ROOT=/path/to/isolated/staging node qc-worker.mjs
```

This invocation processes one queued session, not a long-running background service. Run under an approved job supervisor for live operations. Worker crash/lease recovery and retention policies must be validated before production.