import assert from "node:assert/strict";
import { discoverYoutubeShortCandidates, parseYoutubeDuration } from "../src/YoutubeCandidateDiscovery.mjs";

assert.equal(parseYoutubeDuration("PT1M31S"), 91);
assert.equal(parseYoutubeDuration("PT3M20S"), 200);
assert.equal(parseYoutubeDuration("PT4M"), 240);
assert.equal(parseYoutubeDuration("nonsense"), null);

const requested = [];
const mockFetch = async (url) => {
  const u = new URL(url);
  requested.push(u);
  if (u.pathname.endsWith("/search")) return {
    ok: true,
    status: 200,
    json: async () => ({ items: [
      { id: { kind: "youtube#video", videoId: "aBcDeFgHi01" } },
      { id: { kind: "youtube#video", videoId: "aBcDeFgHi02" } },
      { id: { kind: "youtube#channel", channelId: "not-video" } },
    ] }),
  };
  if (u.pathname.endsWith("/videos")) return {
    ok: true,
    status: 200,
    json: async () => ({ items: [
      {
        id: "aBcDeFgHi01",
        contentDetails: { duration: "PT1M30S" },
        snippet: { title: "A surprising local story", channelTitle: "A Creator", publishedAt: "2026-11-10T09:00:00Z" },
        statistics: { viewCount: "400000", likeCount: "12000", commentCount: "440" },
      },
      {
        id: "aBcDeFgHi02",
        contentDetails: { duration: "PT3M20S" },
        snippet: { title: "Not a Shorts candidate", publishedAt: "2026-11-10T09:00:00Z" },
        statistics: { viewCount: "900000" },
      },
    ] }),
  };
  throw new Error("Unexpected endpoint");
};

const input = {
  apiKey: "test-api-key-not-a-secret",
  query: "busan travel",
  regionCode: "KR",
  publishedAfter: "2026-11-01T00:00:00Z",
  collectedAt: "2026-11-11T09:00:00Z",
  maxResults: 10,
  fetchImpl: mockFetch,
};
const result = await discoverYoutubeShortCandidates(input);
assert.equal(requested.length, 2);
assert.equal(requested[0].searchParams.get("order"), "viewCount");
assert.equal(requested[0].searchParams.get("videoDuration"), "short");
assert.equal(requested[0].searchParams.get("regionCode"), "KR");
assert.equal(requested[1].searchParams.get("part"), "snippet,contentDetails,statistics");
assert.equal(result.candidates.length, 1);
assert.equal(result.candidates[0].publicMetrics.views, 400000);
assert.equal(result.candidates[0].isConfirmedShort, false);
assert.equal(result.candidates[0].distribution, "UNDETERMINED");
assert.equal(result.candidates[0].rightsToReuseMedia, false);
assert.equal(result.policy.searchResultsNotGuaranteedToBeShorts, true);
await assert.rejects(() => discoverYoutubeShortCandidates({ ...input, apiKey: "" }), /API key/);
await assert.rejects(() => discoverYoutubeShortCandidates({ ...input, maxResults: 50 }), /maxResults/);
await assert.rejects(() => discoverYoutubeShortCandidates({ ...input, regionCode: "KOREA" }), /regionCode/);
await assert.rejects(() => discoverYoutubeShortCandidates({ ...input, fetchImpl: async () => ({ ok: false, status: 403 }) }), /HTTP 403/);
console.log("PASS: official YouTube discovery mock, Shorts verification boundary, metrics and credentials");
