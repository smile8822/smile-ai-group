# Bukangi TikTok LIVE assetization validation

This is a SMILE AI GROUP AI Automation Core validation workload.

The purpose is to prove that long, messy LIVE recordings can be converted into reusable, high-quality assets without asking the customer/operator to manually split the source.

## Source behavior

LIVE footage may contain:

- excellent reusable scenes;
- severe shake;
- accidental camera movement;
- blocked subjects;
- bad focus/exposure;
- duplicate angles;
- dead time;
- speech worth preserving;
- background/B-roll worth preserving.

The system must keep the original MASTER intact and promote only good scenes to GOLD.

## Output classes

- GOLD_CLIP: immediately reusable approved scene.
- STORY_CLIP: longer coherent approved sequence.
- B_ROLL: visual support scene.
- SPEECH: useful spoken segment.
- STILL: approved thumbnail/poster frame.
- EVENT: noteworthy reaction or occurrence.
- MASTER_ONLY_REJECTED: never offered as a reusable asset.

## Current validation state

Eight TikTok LIVE source masters are registered in `manifests/bukangi-tiktok-live-2026-10-05.json`.

The first inspected subset already proved that useful scenes can be promoted selectively rather than turning every time segment into an asset.

The remaining large sources must use the server-side range/multipart path. Connector transfer limits must never be treated as a customer upload limit.
