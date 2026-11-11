// Official Google YouTube Data API metadata only. No video downloading or unlicensed frame reuse.
const API_ROOT = "https://www.googleapis.com/youtube/v3";
const MAX_RESULTS = 25;
const MAX_SHORT_CANDIDATE_DURATION_SEC = 180;

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function isoDate(value, label) {
  const str = requiredString(value, label);
  if (!Number.isFinite(Date.parse(str))) throw new Error(`${label} must be an ISO date/time`);
  return str;
}

function integer(value, label, min, max) {
  const num = Number(value);
  if (!Number.isSafeInteger(num) || num < min || num > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}`);
  }
  return num;
}

export function parseYoutubeDuration(value) {
  if (typeof value !== "string") return null;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)(?:\.(\d+))?S)?$/.exec(value);
  if (!m || !(m[1] || m[2] || m[3])) return null;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) + Number(`0.${m[4] || "0"}`);
}

function publicCount(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

async function youtubeGet(path, params, fetchImpl) {
  const u = new URL(`${API_ROOT}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value != null) u.searchParams.set(key, String(value));
  }
  let response;
  try {
    response = await fetchImpl(u.toString(), { method: "GET", headers: { accept: "application/json" } });
  } catch {
    // Do not echo the query URL because it contains the API credential.
    throw new Error("YouTube Data API request failed (network or permission)");
  }
  if (!response?.ok) throw new Error(`YouTube Data API request rejected: HTTP ${response?.status || "unknown"}`);
  let data;
  try { data = await response.json(); } catch { throw new Error("YouTube Data API returned invalid JSON"); }
  if (!data || !Array.isArray(data.items)) throw new Error("YouTube Data API response missing items");
  return data;
}

/**
 * Searches *potential* Shorts; metadata cannot prove a video is vertical or appeared on the Shorts feed.
 * API key must be provisioned by the authorized operator; never hard-code or log it.
 */
export async function discoverYoutubeShortCandidates({
  apiKey,
  query,
  regionCode,
  publishedAfter,
  maxResults = 10,
  collectedAt = new Date().toISOString(),
  fetchImpl = globalThis.fetch,
}) {
  const key = requiredString(apiKey, "YouTube API key");
  const q = requiredString(query, "query");
  const region = requiredString(regionCode, "regionCode").toUpperCase();
  if (!/^[A-Z]{2}$/.test(region)) throw new Error("regionCode must be an ISO 3166-1 alpha-2 code");
  const limit = integer(maxResults, "maxResults", 1, MAX_RESULTS);
  const collected = isoDate(collectedAt, "collectedAt");
  const after = publishedAfter == null ? undefined : isoDate(publishedAfter, "publishedAfter");
  if (after && Date.parse(after) >= Date.parse(collected)) {
    throw new Error("publishedAfter must precede collectedAt");
  }
  if (typeof fetchImpl !== "function") throw new Error("fetchImpl is required");

  const searched = await youtubeGet("search", {
    key,
    part: "snippet",
    q,
    type: "video",
    videoDuration: "short", // Official API means <4 minutes, NOT verified Shorts.
    order: "viewCount",
    regionCode: region, // Availability in region; not audience nationality.
    publishedAfter: after,
    maxResults: limit,
  }, fetchImpl);

  const ids = [...new Set(searched.items
    .filter((item) => item?.id?.kind === "youtube#video")
    .map((item) => item.id.videoId)
    .filter((id) => typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id)))];
  if (!ids.length) return Object.freeze({
    owner: "SMILE_AI_GROUP", platform: "youtube", status: "DISCOVERY_ONLY", collectedAt: collected,
    query: q, discoveryRegionCode: region, candidates: Object.freeze([]),
  });

  const enriched = await youtubeGet("videos", {
    key,
    part: "snippet,contentDetails,statistics",
    id: ids.join(","),
  }, fetchImpl);
  const detailById = new Map(enriched.items.map((item) => [item.id, item]));
  const candidates = [];
  for (const id of ids) {
    const item = detailById.get(id);
    if (!item) continue;
    const durationSec = parseYoutubeDuration(item.contentDetails?.duration);
    if (!Number.isFinite(durationSec) || durationSec <= 0 || durationSec > MAX_SHORT_CANDIDATE_DURATION_SEC) continue;
    const publishedAt = item.snippet?.publishedAt;
    if (!Number.isFinite(Date.parse(publishedAt)) || Date.parse(publishedAt) > Date.parse(collected)) continue;
    const views = publicCount(item.statistics?.viewCount);
    if (views == null) continue;
    const days = Math.max(1, (Date.parse(collected) - Date.parse(publishedAt)) / 86400000);
    candidates.push(Object.freeze({
      id: `YOUTUBE_VIDEO_${id}`,
      platform: "youtube",
      candidateStatus: "UNVERIFIED_SHORTS_CANDIDATE",
      sourceUrl: `https://www.youtube.com/watch?v=${id}`,
      title: item.snippet?.title || "",
      channelTitle: item.snippet?.channelTitle || null,
      publishedAt,
      durationSec,
      publicMetrics: Object.freeze({ views, likes: publicCount(item.statistics?.likeCount), comments: publicCount(item.statistics?.commentCount) }),
      viewVelocityPerDayHeuristic: Number((views / days).toFixed(2)),
      metricScope: "SINGLE_VIDEO",
      distribution: "UNDETERMINED",
      visualReviewStatus: "NOT_REVIEWED",
      isConfirmedShort: false,
      rightsToReuseMedia: false,
    }));
  }
  candidates.sort((a, b) => b.viewVelocityPerDayHeuristic - a.viewVelocityPerDayHeuristic);
  return Object.freeze({
    owner: "SMILE_AI_GROUP",
    platform: "youtube",
    status: "DISCOVERY_ONLY",
    collectedAt: collected,
    query: q,
    discoveryRegionCode: region,
    candidates: Object.freeze(candidates),
    policy: Object.freeze({
      searchResultsNotGuaranteedToBeShorts: true,
      regionCodeIsAvailabilityNotViewerLocation: true,
      publicCountsDoNotRevealPaidDistributionOrRetention: true,
      viewVelocityIsOnlyAResearchHeuristic: true,
      noAutomaticGoldenPromotion: true,
      noUnlicensedMediaReuse: true,
    }),
  });
}
