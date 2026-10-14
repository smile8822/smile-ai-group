# SMILE CAPTURE LIVE intake — code only, NOT DEPLOYED

TikTok's own app camera is not available to the capture browser. With TikTok-authorized external encoder access, a broadcaster may send one authenticated RTMPS stream to this isolated recorder and use an authorized routing strategy for TikTok. No TikTok forwarding is implemented here.

- MediaMTX staging: **RTMPS strict** using CA-trusted TLS certificate/private key mounted under /certs, plus private publisher credential via MTX_AUTHINTERNALUSERS_0_PASS. Do not expose public plaintext RTMP or commit secrets. Limit port 1936 via firewall/VPN.
- Output: 20-second fMP4 recordings under /recordings/live. The separate live-archive-worker.mjs only mirrors stable, finished segments into the private object store. It never deletes files, marks GOLD, or publishes.
- Storage: dedicated host and disk, private object-store prefix, monitoring, reserve/lifecycle budget. The existing 80 GB MISO staging server and 10/11 source are out of scope.
- CI test: ops/live/mediamtx.ci.yml is **test-only loopback-bound plaintext**, NOT for deployment. CI generates synthetic AV with FFmpeg and inspects the created recording. No user/TikTok content involved.
- Actual deployment requires approved host/domain, storage credentials, TLS, Android encoder test, audio/video continuity review, per-session quota controls, and real stream authorization. No account stream key is presumed.

Platform constraints: external encoder availability is account-specific. Without it, use a separate recording device or authorized TikTok replay import. Never promise simultaneous capture of the native TikTok app camera.
