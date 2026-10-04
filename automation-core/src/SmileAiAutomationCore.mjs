export const SMILE_AI_AUTOMATION_OWNER = "SMILE_AI_GROUP";

export const SMILE_AI_AUTOMATION_ENTRY = [
  "MEMBER",
  "SMILE_PAY_SP",
  "SP_USAGE",
  "AI_AUTOMATION_SERVICE",
];

export const SMILE_AI_AUTOMATION_POLICY = Object.freeze({
  customerManualSplitRequired: false,
  customerToolSelectionRequired: false,
  customerRetriesInternalSteps: false,
  immutableMasterRequired: true,
  resumableLargeUploadRequired: true,
  directObjectStorageUploadForLargeCustomerFiles: true,
  serverSideRangeImportForRemoteLargeFiles: true,
  wholeLargeSourceBufferInApplicationMemoryAllowed: false,
  proxyBeforeFullSemanticAnalysis: true,
  goldRequiresVisualQc: true,
  goldRequiresDecodeQc: true,
  rejectedSceneMayEnterGoldRegistry: false,
  failedPipelineMayEnterGoldenRegistry: false,
  goldMustKeepMasterLineage: true,
  durableJobsRequired: true,
  checkpointRecoveryRequired: true,
});

export const SMILE_AI_AUTOMATION_PIPELINE = Object.freeze([
  "REQUEST_UNDERSTOOD",
  "INPUTS_CLASSIFIED",
  "ASSETS_BOUND",
  "GOLDEN_MODULES_RESOLVED",
  "EXECUTION_PLAN_LOCKED",
  "DURABLE_JOB_STARTED",
  "PRODUCTION_EXECUTED",
  "QC_PASSED",
  "DELIVERED_OR_PUBLISHED",
]);

export const SMILE_AI_LARGE_MEDIA_PIPELINE = Object.freeze([
  "SOURCE_REGISTERED",
  "MASTER_INGESTING",
  "MASTER_STORED",
  "MASTER_VERIFIED",
  "PROXY_READY",
  "SCENE_INDEXED",
  "GOLD_CANDIDATES_SELECTED",
  "GOLD_VISUAL_QC_PASSED",
  "GOLD_DECODE_QC_PASSED",
  "GOLD_ASSETS_REGISTERED",
]);

export const SERVICE_BOUNDARIES = Object.freeze({
  GROUP_CORE: {
    owner: "SMILE_AI_GROUP",
    responsibilities: [
      "UPLOAD_AND_INTAKE",
      "PRIVATE_STORAGE",
      "ASSET_LINEAGE",
      "PROXY_GENERATION",
      "SCENE_INDEXING",
      "QUALITY_SCORING",
      "GOLD_ASSET_PROMOTION",
      "GOLDEN_MODULE_REGISTRY",
      "PIPELINE_COMPOSITION",
      "DURABLE_JOBS",
      "CHECKPOINT_RECOVERY",
      "GENERIC_QC",
      "DELIVERY",
      "PUBLISHING_ORCHESTRATION",
    ],
  },
  MISO: {
    role: "SERVICE_CONSUMER",
    customerServiceOwner: false,
    responsibilities: [
      "MISO_CHARACTER_IDENTITY",
      "MISO_VOICE_MASTER",
      "MISO_BRAND_RULES",
      "MISO_LAYOUT_RULES",
      "MISO_SERVICE_VIDEO_RECIPES",
    ],
  },
});

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const TIB = 1024 * GIB;

export const MULTIPART_LIMITS = Object.freeze({
  minimumPartSizeBytes: 5 * MIB,
  preferredPartSizeBytes: 64 * MIB,
  maximumPartSizeBytes: 5 * GIB,
  maximumParts: 10_000,
  maximumObjectSizeBytes: 5 * TIB,
});

function roundUp(value, unit) {
  return Math.ceil(value / unit) * unit;
}

export function planMultipartUpload(sizeBytes, preferredPartSizeBytes = MULTIPART_LIMITS.preferredPartSizeBytes) {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw new Error("Source size must be a positive safe integer.");
  }
  if (sizeBytes > MULTIPART_LIMITS.maximumObjectSizeBytes) {
    throw new Error("Source exceeds object-storage boundary.");
  }

  const minimumNeeded = Math.ceil(sizeBytes / MULTIPART_LIMITS.maximumParts);
  const partSizeBytes = Math.max(
    MULTIPART_LIMITS.minimumPartSizeBytes,
    roundUp(preferredPartSizeBytes, MIB),
    roundUp(minimumNeeded, MIB),
  );

  if (partSizeBytes > MULTIPART_LIMITS.maximumPartSizeBytes) {
    throw new Error("Multipart part size exceeds provider boundary.");
  }

  const partCount = Math.ceil(sizeBytes / partSizeBytes);
  if (partCount > MULTIPART_LIMITS.maximumParts) {
    throw new Error("Multipart upload requires too many parts.");
  }

  return { sizeBytes, partSizeBytes, partCount };
}

export function evaluateGoldScene(input) {
  const scores = [
    input.visualQualityScore,
    input.stabilityScore,
    input.editorialUsefulnessScore,
    input.duplicateRiskScore,
  ];
  if (scores.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error("Quality scores must be in [0, 1].");
  }

  if (
    input.hasBlockingOcclusion ||
    input.hasSevereFocusFailure ||
    input.hasSevereExposureFailure ||
    input.hasCorruptFrames ||
    input.isAccidentalHandlingFootage
  ) {
    return "MASTER_ONLY_REJECTED";
  }

  if (
    input.visualQualityScore < 0.72 ||
    input.stabilityScore < 0.68 ||
    input.editorialUsefulnessScore < 0.70 ||
    input.duplicateRiskScore > 0.82
  ) {
    return "MASTER_ONLY_REJECTED";
  }

  return "GOLD_CANDIDATE";
}
