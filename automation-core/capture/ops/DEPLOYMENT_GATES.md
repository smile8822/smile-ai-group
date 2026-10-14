# SMILE CAPTURE V4 — dedicated staging requirements

Status: **code tested with a mock S3 endpoint; NOT deployed; NOT Android-tested**.

## Before deployment
- Dedicated test host and domain. Do NOT reuse the MISO private staging server.
- Trusted TLS/HTTPS, isolated spool volume, disk alarms, firewall, operational monitoring and rate limits.
- Private S3-compatible storage bucket and service keys restricted to staged capture prefix only. No public read access.
- Separate authentication and access protection. A single static bearer token is suitable only for an internal supervised prototype.
- Validate path-style S3 signing, PUT+HEAD metadata round-trip and disk limit before allowing real footage.
- Never commit .env, downloaded recordings or any tokens.

## Practical test
1. Android Chrome > 15 min foreground camera+audio recording on HTTPS. Check time continuity, codec and microphone.
2. Lose mobile connection mid-recording, recover, confirm no missing segments and SHA integrity.
3. Close browser during a recording: interrupted session must not be marked complete.
4. Intentionally block a prior source while newer session uploads. Both retain independent checkpoints.
5. Validate private remote mirrored segments, assembled media and full FFmpeg decode.
6. Test full local disk (HTTP 507), worker crash, stale queue/lease recovery, secure retention, audit logs and recovery.
7. No automatic publication; child privacy, music licensing and all editorial QC must be approved separately.

## LIVE boundary
- TikTok app-only LIVE video is not available to browser MediaRecorder while TikTok owns the camera. This needs a second device or a legitimate archive import.
- TikTok-eligible external encoder may later feed a secured RTMP/SRT receiver. There is **no** tested RTMP relay or TikTok publishing in V4.

## Deployment on approved isolated staging only
Copy .env.example to .env and enter real private values. Protect with chmod 600.
Run docker compose --env-file .env -f compose.staging.yml config --quiet, then up -d --build.
Test authenticated /api/sessions, HTTPS and mirroring before using real event footage.
This configuration is a starting point and must be independently security-reviewed; do not treat it as production-ready.
