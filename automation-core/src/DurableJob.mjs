const JOB_STATUS = Object.freeze({
  PLANNED: "PLANNED",
  RUNNING: "RUNNING",
  RETRY_WAIT: "RETRY_WAIT",
  QC_PENDING: "QC_PENDING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
});

const transitions = Object.freeze({
  PLANNED: new Set(["RUNNING", "CANCELLED"]),
  RUNNING: new Set(["RETRY_WAIT", "QC_PENDING", "FAILED", "CANCELLED"]),
  RETRY_WAIT: new Set(["RUNNING", "FAILED", "CANCELLED"]),
  QC_PENDING: new Set(["COMPLETED", "RETRY_WAIT", "FAILED"]),
  COMPLETED: new Set(),
  FAILED: new Set(),
  CANCELLED: new Set(),
});

export function createDurableJob({ jobId, requestId, tenantId, plan }) {
  if (!jobId || !requestId || !tenantId || !plan?.locked) {
    throw new Error("Durable job requires identifiers and a locked execution plan.");
  }
  return {
    jobId,
    requestId,
    tenantId,
    owner: "SMILE_AI_GROUP",
    status: JOB_STATUS.PLANNED,
    attempt: 0,
    checkpoint: null,
    plan,
    providerReceipts: {},
    artifacts: [],
    lastError: null,
  };
}

export function transitionJob(job, nextStatus, patch = {}) {
  if (!transitions[job.status]?.has(nextStatus)) {
    throw new Error(`Invalid job transition: ${job.status} -> ${nextStatus}`);
  }
  return {
    ...job,
    ...patch,
    status: nextStatus,
  };
}

export function startJob(job) {
  return transitionJob(job, JOB_STATUS.RUNNING, {
    attempt: job.attempt + 1,
    lastError: null,
  });
}

export function checkpointJob(job, checkpoint) {
  if (job.status !== JOB_STATUS.RUNNING && job.status !== JOB_STATUS.QC_PENDING) {
    throw new Error("Checkpoint may only be written while work is active.");
  }
  if (!checkpoint?.stage || !checkpoint?.idempotencyKey) {
    throw new Error("Checkpoint requires stage and idempotencyKey.");
  }
  return {
    ...job,
    checkpoint: Object.freeze({ ...checkpoint }),
  };
}

export function recordProviderReceipt(job, providerKey, receipt) {
  if (!providerKey || !receipt?.idempotencyKey) {
    throw new Error("Provider receipt requires provider key and idempotency key.");
  }
  return {
    ...job,
    providerReceipts: {
      ...job.providerReceipts,
      [providerKey]: Object.freeze({ ...receipt }),
    },
  };
}

export { JOB_STATUS };
