const ASSET_STATE = Object.freeze({
  MASTER: "MASTER",
  GOLD: "GOLD",
  REJECTED_MASTER_ONLY: "REJECTED_MASTER_ONLY",
});

const assets = new Map();

function assertId(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

export function registerMasterAsset(input) {
  const assetId = assertId(input.assetId, "assetId");
  if (assets.has(assetId)) throw new Error(`Asset already exists: ${assetId}`);
  const asset = Object.freeze({
    assetId,
    owner: "SMILE_AI_GROUP",
    tenantId: assertId(input.tenantId, "tenantId"),
    state: ASSET_STATE.MASTER,
    sourceKind: assertId(input.sourceKind, "sourceKind"),
    storageKey: assertId(input.storageKey, "storageKey"),
    originalName: input.originalName || null,
    sourceAssetId: null,
    sourceStartMs: null,
    sourceEndMs: null,
    tags: Object.freeze([...(input.tags || [])]),
    qc: null,
  });
  assets.set(assetId, asset);
  return asset;
}

export function promoteGoldAsset(input) {
  const master = assets.get(input.masterAssetId);
  if (!master || master.state !== ASSET_STATE.MASTER) {
    throw new Error("GOLD asset requires a registered MASTER asset.");
  }
  if (master.tenantId !== input.tenantId) {
    throw new Error("Cross-tenant GOLD promotion is forbidden.");
  }
  if (!input.visualQcPassed || !input.decodeQcPassed) {
    throw new Error("GOLD promotion requires visual and decode QC.");
  }
  if (
    !Number.isFinite(input.startMs) ||
    !Number.isFinite(input.endMs) ||
    input.startMs < 0 ||
    input.endMs <= input.startMs
  ) {
    throw new Error("GOLD asset requires a valid source time range.");
  }

  const assetId = assertId(input.assetId, "assetId");
  if (assets.has(assetId)) throw new Error(`Asset already exists: ${assetId}`);

  const asset = Object.freeze({
    assetId,
    owner: "SMILE_AI_GROUP",
    tenantId: input.tenantId,
    state: ASSET_STATE.GOLD,
    sourceKind: "MASTER_TIMECODE",
    storageKey: assertId(input.storageKey, "storageKey"),
    originalName: input.originalName || null,
    sourceAssetId: master.assetId,
    sourceStartMs: input.startMs,
    sourceEndMs: input.endMs,
    tags: Object.freeze([...(input.tags || [])]),
    qc: Object.freeze({
      visualQcPassed: true,
      decodeQcPassed: true,
      qualityScore: input.qualityScore ?? null,
    }),
  });
  assets.set(assetId, asset);
  return asset;
}

export function registerRejectedScene(input) {
  const master = assets.get(input.masterAssetId);
  if (!master || master.state !== ASSET_STATE.MASTER) {
    throw new Error("Rejected scene requires a registered MASTER asset.");
  }
  return Object.freeze({
    owner: "SMILE_AI_GROUP",
    tenantId: master.tenantId,
    state: ASSET_STATE.REJECTED_MASTER_ONLY,
    masterAssetId: master.assetId,
    startMs: input.startMs,
    endMs: input.endMs,
    reasons: Object.freeze([...(input.reasons || [])]),
    reusable: false,
  });
}

export function listAssetsForTenant(tenantId) {
  return [...assets.values()].filter((asset) => asset.tenantId === tenantId);
}

export function listGoldAssetsForTenant(tenantId) {
  return listAssetsForTenant(tenantId).filter(
    (asset) => asset.state === ASSET_STATE.GOLD,
  );
}

export function clearAssetRegistryForTests() {
  assets.clear();
}

export { ASSET_STATE };
