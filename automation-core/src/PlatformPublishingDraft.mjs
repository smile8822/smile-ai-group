const PLATFORMS = new Set(["tiktok", "instagram", "youtube", "facebook"]);
const LANGUAGES = new Set(["ko", "id", "en", "zh", "ja"]);
const BRAND_TAGS = new Set(["#SMILEAIGROUP", "#MISO", "#CORE", "#SMILEPAY"]);
const YOUTUBE_PRIVACY = new Set(["private", "unlisted", "public"]);

function nonempty(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function verifiedDate(value, label) {
  const parsed = Date.parse(nonempty(value, label));
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be an ISO timestamp`);
  return parsed;
}

function tag(value, label) {
  const normalized = nonempty(value, label);
  if (!/^#[\p{L}\p{N}_]+$/u.test(normalized)) throw new Error(`${label} is not a valid complete hashtag`);
  return normalized;
}

function checkUniqueTags(groups) {
  const seen = new Set();
  for (const [category, items] of Object.entries(groups)) {
    if (!Array.isArray(items)) throw new Error(`hashtags.${category} must be an array`);
    for (let index = 0; index < items.length; index++) {
      const value = tag(typeof items[index] === "string" ? items[index] : items[index]?.tag, `${category}[${index}]`);
      const key = value.normalize("NFKC").toUpperCase();
      if (seen.has(key)) throw new Error(`Duplicate hashtag across categories: ${value}`);
      seen.add(key);
    }
  }
}

function hashtagsFor(input, checkedAtMs) {
  const groups = input.hashtags || {};
  const topics = groups.topic || [];
  const regions = groups.region || [];
  const trends = groups.trend || [];
  const brands = groups.brand || [];
  checkUniqueTags({ topic: topics, region: regions, trend: trends, brand: brands });
  if (!Array.isArray(brands) || brands.length > 2) throw new Error("Company brand hashtags are limited to two");
  const registered = brands.map((value) => tag(value, "brand hashtag"));
  if (registered.some((value) => !BRAND_TAGS.has(value.toUpperCase()))) {
    throw new Error("Unapproved company brand hashtag");
  }
  const ordered = [...topics.map((value) => tag(value, "topic hashtag")), ...regions.map((value) => tag(value, "region hashtag"))];
  for (const item of trends) {
    const trending = tag(item?.tag, "trend hashtag");
    if (item?.verified !== true || !/^https:\/\/\S+$/.test(item.sourceUrl || "")) {
      throw new Error(`Trend tag ${trending} requires verified, HTTPS source provenance`);
    }
    const observed = verifiedDate(item.observedAt, `${trending}.observedAt`);
    if (checkedAtMs < observed || checkedAtMs - observed > 24 * 60 * 60 * 1000) {
      throw new Error(`Trend tag ${trending} is stale or from the future`);
    }
    ordered.push(trending);
  }
  ordered.push(...registered);
  if (!input.coreRelated && ordered.some((value) => value.toUpperCase() === "#CORE")) {
    throw new Error("#CORE is forbidden for topics unrelated to CORE");
  }
  if (ordered.slice(0, ordered.length - registered.length).some((value) => BRAND_TAGS.has(value.toUpperCase()))) {
    throw new Error("Group brand hashtags must only appear at the end");
  }
  return Object.freeze(ordered);
}

function locationDecision(location, platform, support) {
  if (location == null) return Object.freeze({ requested: false, nativeGeotag: null });
  const name = nonempty(location.name, "location.name");
  if (location.recordedOnScene !== true || location.verified !== true ||
      !/^https:\/\/\S+$/.test(location.evidenceUrl || "")) {
    throw new Error("Location tags require verified video-scene provenance");
  }
  if (support?.platform !== platform || support?.verified !== true || support?.supportsLocationTag !== true) {
    return Object.freeze({ requested: true, locationName: name, nativeGeotag: null, manualPlatformCheckRequired: true });
  }
  return Object.freeze({ requested: true, locationName: name, nativeGeotag: name, manualPlatformCheckRequired: true });
}

function accountPrivacy(input, platform) {
  if (platform === "youtube") {
    const choice = nonempty(input.privacyChoice, "youtube.privacyChoice");
    if (!YOUTUBE_PRIVACY.has(choice)) throw new Error("Invalid YouTube privacy status");
    return Object.freeze({ requested: choice, canAutoApply: false, finalOwnerApprovalRequired: true });
  }
  if (platform === "tiktok") {
    const choice = nonempty(input.privacyChoice, "tiktok.privacyChoice");
    const allowed = input.creatorPrivacyOptions;
    if (!Array.isArray(allowed) || !allowed.includes(choice) || input.creatorInfoVerified !== true) {
      throw new Error("TikTok privacy choice must match current, verified creator_info privacy options");
    }
    return Object.freeze({ requested: choice, canAutoApply: false, finalOwnerApprovalRequired: true });
  }
  return Object.freeze({ requested: null, canAutoApply: false, platformAccountReviewRequired: true });
}

function youtubeKeywords(raw) {
  if (raw == null) return Object.freeze([]);
  if (!Array.isArray(raw)) throw new Error("YouTube keyword tags must be an array");
  const entries = raw.map((value) => nonempty(value, "YouTube keyword"));
  const calculatedLength = entries.map((value) => value.includes(" ") ? value.length + 2 : value.length)
    .reduce((sum, length) => sum + length, Math.max(0, entries.length - 1));
  if (calculatedLength > 500) throw new Error("YouTube keyword tags exceed 500 characters");
  return Object.freeze(entries);
}

/** No publisher calls. Drafts must be reviewed with the real account, media and platform capabilities. */
export function createPlatformPublishingDraftPackage({
  creativePlan,
  targets,
  draftInputs,
  checkedAt,
  platformLocationCapabilities = {},
}) {
  if (creativePlan?.status !== "ORIGINAL_PLANS_PREPARED_NOT_RENDERED" ||
      creativePlan?.productionPermission !== false || creativePlan?.publicationPermission !== false) {
    throw new Error("Only validated, non-rendered research-first planning output can enter the draft stage");
  }
  const validPlatforms = new Set(creativePlan.creativeExecutionSpec?.targetPlatforms || []);
  if (!Array.isArray(targets) || !targets.length) throw new Error("Explicit publication targets are required");
  if (!Array.isArray(draftInputs) || draftInputs.length !== targets.length) {
    throw new Error("Exactly one draft input per explicitly requested target is required");
  }
  const checkedAtMs = verifiedDate(checkedAt, "checkedAt");
  const targetById = new Map();
  const uniqueChannelLanguages = new Set();
  for (const item of targets) {
    const id = nonempty(item.id, "target.id");
    const platform = nonempty(item.platform, "target.platform");
    const language = nonempty(item.language, "target.language");
    const channelKey = nonempty(item.channelKey, "target.channelKey");
    if (!PLATFORMS.has(platform) || !validPlatforms.has(platform)) {
      throw new Error(`Target platform was not requested in creative planning: ${platform}`);
    }
    if (!LANGUAGES.has(language)) throw new Error(`Unsupported language: ${language}`);
    if (targetById.has(id)) throw new Error(`Duplicate target ID: ${id}`);
    const channelLanguage = `${platform}|${channelKey}|${language}`;
    if (uniqueChannelLanguages.has(channelLanguage)) throw new Error(`Duplicate same-account language draft: ${channelLanguage}`);
    uniqueChannelLanguages.add(channelLanguage);
    targetById.set(id, Object.freeze({ id, platform, language, channelKey }));
  }

  const usedInputs = new Set();
  const copyByLocale = new Map();
  const drafts = draftInputs.map((input) => {
    const targetId = nonempty(input.targetId, "draft.targetId");
    if (!targetById.has(targetId)) throw new Error(`Unrequested publication target: ${targetId}`);
    if (usedInputs.has(targetId)) throw new Error(`Duplicate publication input: ${targetId}`);
    usedInputs.add(targetId);
    const target = targetById.get(targetId);
    const metadataTitle = nonempty(input.metadataTitle, `${targetId}.metadataTitle`);
    const body = nonempty(input.bodyText, `${targetId}.bodyText`);
    if (/[#<>]/u.test(body)) throw new Error("Post body must not embed unmanaged hashtags or markup");
    if (metadataTitle.includes("<") || metadataTitle.includes(">")) throw new Error("Metadata title contains unsupported angle brackets");
    const orderedTags = hashtagsFor(input, checkedAtMs);
    const caption = `${body}\n\n${orderedTags.join(" ")}`.trim();
    if (target.platform === "youtube") {
      if ([...metadataTitle].length > 100) throw new Error("YouTube title exceeds 100 characters");
      if (Buffer.byteLength(caption, "utf8") > 5000) throw new Error("YouTube description exceeds 5000 UTF-8 bytes");
    }
    if (target.platform === "tiktok" && caption.length > 2200) {
      throw new Error("TikTok caption exceeds 2200 UTF-16 code units");
    }
    const normalizedCopy = `${metadataTitle} ${body}`.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
    const copyId = `${target.language}|${normalizedCopy}`;
    if (copyByLocale.has(copyId) && copyByLocale.get(copyId) !== target.platform) {
      throw new Error(`Identical same-language copy is forbidden across SNS: ${target.language}`);
    }
    copyByLocale.set(copyId, target.platform);
    const privacy = accountPrivacy(input, target.platform);
    const location = locationDecision(input.location, target.platform, platformLocationCapabilities[target.platform]);
    const metadata = target.platform === "youtube"
      ? Object.freeze({ title: metadataTitle, description: caption, defaultLanguage: target.language, privacyStatus: privacy.requested, keywordTags: youtubeKeywords(input.youtubeKeywordTags) })
      : target.platform === "tiktok"
        ? Object.freeze({ titleFieldIsCaption: true, caption, privacyLevel: privacy.requested })
        : Object.freeze({ caption, provisionalEditorialHeadline: metadataTitle, apiMappingRequiresReview: true });
    return Object.freeze({
      ...target,
      metadata,
      titleForPlanning: metadataTitle,
      orderedHashtags: orderedTags,
      location,
      privacy,
      languageQCPending: true,
      frameQCPending: true,
      musicAndMediaRightsPending: true,
      accountPermissionPending: true,
      platformAdapterVerified: false,
      approvedToPublish: false,
    });
  });
  for (const targetId of targetById.keys()) {
    if (!usedInputs.has(targetId)) throw new Error(`Missing publication draft for ${targetId}`);
  }
  return Object.freeze({
    owner: "SMILE_AI_GROUP",
    status: "DRAFT_ONLY_WAITING_FOR_MEDIA_ACCOUNT_AND_PLATFORM_QC",
    checkedAt,
    explicitTargetsOnly: true,
    draftCount: drafts.length,
    drafts: Object.freeze(drafts),
    productionPermission: false,
    publicationPermission: false,
    livePlatformAccountConnected: false,
    reason: "Native platform metadata, account privacy, content rights, rendered frame, locale and owner approval still pending",
  });
}
