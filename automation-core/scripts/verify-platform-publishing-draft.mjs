import assert from "node:assert/strict";
import { createPlatformPublishingDraftPackage } from "../src/PlatformPublishingDraft.mjs";

// Synthetic unit fixtures only; not live platform accounts, real video research, or publishable media.
const creativePlan = {
  status: "ORIGINAL_PLANS_PREPARED_NOT_RENDERED",
  productionPermission: false,
  publicationPermission: false,
  creativeExecutionSpec: { targetPlatforms: ["tiktok", "instagram", "youtube", "facebook"] },
};
const targets = [
  { id: "tt-ko", platform: "tiktok", language: "ko", channelKey: "SAME_TIKTOK_ACCOUNT" },
  { id: "tt-id", platform: "tiktok", language: "id", channelKey: "SAME_TIKTOK_ACCOUNT" },
  { id: "ig-ko", platform: "instagram", language: "ko", channelKey: "INSTAGRAM_ACCOUNT" },
  { id: "yt-ko", platform: "youtube", language: "ko", channelKey: "YOUTUBE_CHANNEL" },
  { id: "fb-ko", platform: "facebook", language: "ko", channelKey: "FACEBOOK_PAGE" },
];
const trendEvidence = {
  tag: "#오늘의발견", verified: true,
  sourceUrl: "https://www.example.org/trend-evidence-synthetic",
  observedAt: "2026-11-11T07:30:00Z",
};
const basic = (targetId, metadataTitle, bodyText) => ({
  targetId, metadataTitle, bodyText,
  coreRelated: false,
  hashtags: {
    topic: ["#부산여행"], region: ["#부산", "#대한민국"],
    trend: [trendEvidence], brand: [],
  },
});
const tiktokInfo = {
  creatorInfoVerified: true,
  creatorPrivacyOptions: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"],
  privacyChoice: "PUBLIC_TO_EVERYONE",
};
const draftInputs = [
  { ...basic("tt-ko", "이런 순간 처음 보셨나요?", "부산의 현장에서 직접 발견한 장면입니다. 여러분 생각은 어떠세요?"), ...tiktokInfo },
  { ...basic("tt-id", "Cerita hari ini di Busan", "Kami menemukan adegan ini di Busan. Bagaimana pendapatmu?"), ...tiktokInfo, hashtags: {
    topic: ["#WisataBusan"], region: ["#Busan", "#KoreaSelatan"], trend: [], brand: [],
  } },
  { ...basic("ig-ko", "부산에서 발견한 뜻밖의 장면", "이런 모습을 보신 적 있나요? 잊기 어려운 현장을 소개합니다."), hashtags: {
    topic: ["#부산브이로그"], region: ["#부산"], trend: [], brand: [],
  } },
  { ...basic("yt-ko", "부산 현장 이야기 | 직접 본 장면", "현장에서 본 장면의 맥락을 직접 살펴봅니다. 여러분의 의견을 댓글로 알려 주세요."), privacyChoice: "private", youtubeKeywordTags: ["부산", "여행 쇼츠"] },
  { ...basic("fb-ko", "여러분도 이런 경험이 있으신가요?", "부산에 사는 사람들의 일상을 담았습니다. 생각을 함께 나눠 주세요."), location: {
    name: "부산", recordedOnScene: true, verified: true,
    evidenceUrl: "https://www.example.org/video-location-synthetic",
  } },
];
const args = {
  creativePlan, targets, draftInputs, checkedAt: "2026-11-11T08:00:00Z",
  platformLocationCapabilities: {},
};
const result = createPlatformPublishingDraftPackage(args);
assert.equal(result.status, "DRAFT_ONLY_WAITING_FOR_MEDIA_ACCOUNT_AND_PLATFORM_QC");
assert.equal(result.productionPermission, false);
assert.equal(result.publicationPermission, false);
assert.equal(result.drafts.length, 5);
assert.deepEqual(result.drafts[0].orderedHashtags, ["#부산여행", "#부산", "#대한민국", "#오늘의발견"]);
assert.equal(result.drafts[0].metadata.privacyLevel, "PUBLIC_TO_EVERYONE");
assert.equal(result.drafts[1].channelKey, result.drafts[0].channelKey);
assert.equal(result.drafts[3].metadata.privacyStatus, "private");
assert.deepEqual(result.drafts[3].metadata.keywordTags, ["부산", "여행 쇼츠"]);
assert.equal(result.drafts[4].location.nativeGeotag, null);
assert.equal(result.drafts[4].location.manualPlatformCheckRequired, true);
assert.ok(result.drafts.every((draft) => draft.approvedToPublish === false));

function rejects(changes, pattern) {
  assert.throws(() => createPlatformPublishingDraftPackage({ ...args, ...changes }), pattern);
}
function changed(index, update) {
  return draftInputs.map((entry, i) => i === index ? { ...entry, ...update } : entry);
}
rejects({ targets: [...targets, { id: "unrequested", platform: "youtube", language: "ja", channelKey: "ANY" }] }, /Exactly one draft input/);
rejects({ targets: targets.map((entry, i) => i === 4 ? { ...entry, platform: "unrequested" } : entry) }, /not requested in creative planning/);
rejects({ targets: targets.map((entry, i) => i === 1 ? { ...entry, language: "ko" } : entry) }, /Duplicate same-account language draft/);
rejects({ draftInputs: changed(2, { metadataTitle: draftInputs[0].metadataTitle, bodyText: draftInputs[0].bodyText }) }, /Identical same-language copy/);
rejects({ draftInputs: changed(0, { creatorInfoVerified: false }) }, /current, verified creator_info/);
rejects({ draftInputs: changed(0, { privacyChoice: "PRIVATE_SOMETHING" }) }, /current, verified creator_info/);
rejects({ draftInputs: changed(0, { hashtags: { topic: ["#CORE"], region: [], trend: [], brand: [] } }) }, /#CORE is forbidden/);
rejects({ draftInputs: changed(0, { hashtags: { topic: ["#SMILEAIGROUP"], region: [], trend: [], brand: [] } }) }, /Group brand hashtags must only appear at the end/);
rejects({ draftInputs: changed(0, { hashtags: { topic: [], region: [], trend: [], brand: ["#SMILEAIGROUP", "#MISO", "#CORE"] } }) }, /limited to two/);
rejects({ draftInputs: changed(0, { hashtags: { topic: [], region: [], trend: [], brand: ["#SMILEAIGROUP"] } }) }, /content-relevant company brand evidence/);
const reviewedCompanyContext = {
  relatedToCompany: true, scriptReviewVerified: true,
  reviewerId: "fixture-human-reviewer", evidenceRef: "fixture-script-showing-miso-service",
  featuredBrandTags: ["#MISO"],
};
rejects({ draftInputs: changed(0, { brandRelevance: reviewedCompanyContext,
  hashtags: { topic: [], region: [], trend: [], brand: ["#SMILEAIGROUP"] } }) }, /does not match the company brand actually featured/);
const companyDrafts = changed(0, {
  metadataTitle: "MISO AI 서비스 실제 사용 안내",
  bodyText: "미소 AI 서비스를 활용하는 방법을 소개합니다.",
  brandRelevance: reviewedCompanyContext,
  hashtags: { topic: ["#AI서비스"], region: [], trend: [], brand: ["#MISO"] },
});
const companyResult = createPlatformPublishingDraftPackage({ ...args, draftInputs: companyDrafts });
assert.deepEqual(companyResult.drafts[0].orderedHashtags, ["#AI서비스", "#MISO"]);
rejects({ draftInputs: changed(0, { hashtags: { topic: [], region: [], trend: [{ ...trendEvidence, verified: false }], brand: [] } }) }, /verified, HTTPS source/);
rejects({ draftInputs: changed(0, { hashtags: { topic: [], region: [], trend: [{ ...trendEvidence, observedAt: "2026-11-01T07:30:00Z" }], brand: [] } }) }, /stale or from the future/);
rejects({ draftInputs: changed(4, { location: { name: "부산", recordedOnScene: true, verified: false, evidenceUrl: "https://www.example.org/scene" } }) }, /Location tags require verified/);
rejects({ draftInputs: changed(3, { metadataTitle: "A".repeat(101) }) }, /YouTube title exceeds/);
rejects({ draftInputs: changed(3, { youtubeKeywordTags: ["LongTag".repeat(90)] }) }, /exceed 500/);
rejects({ draftInputs: changed(0, { bodyText: "See #unknown trending hashtag" }) }, /unmanaged hashtags/);
rejects({ creativePlan: { ...creativePlan, publicationPermission: true } }, /non-rendered research-first/);

console.log("PASS: explicit account/language targets, per-SNS wording, brand tag order, trend provenance, location hold, privacy checks, no publishing");
