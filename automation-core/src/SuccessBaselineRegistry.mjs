const SUCCESS_BASELINE_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  SUPERSEDED: "SUPERSEDED",
  RETIRED: "RETIRED",
});

const baselines = new Map();

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

function toTimestamp(value, label) {
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) throw new Error(`${label} must be an ISO date/time`);
  return ts;
}

function normalizeScope(scope = {}) {
  return Object.freeze({
    serviceScope: scope.serviceScope || null,
    outputKind: scope.outputKind || null,
    contentClass: scope.contentClass || null,
    capability: scope.capability || null,
    platform: scope.platform || null,
    language: scope.language || null,
    country: scope.country || null,
  });
}

function scopeKey(scope) {
  return JSON.stringify(normalizeScope(scope));
}

function matchesScope(baselineScope, context = {}) {
  return Object.entries(baselineScope).every(([key, value]) => {
    if (value == null) return true;
    return context[key] === value;
  });
}

function sortCurrent(a, b) {
  const qa = Number(a.qualityScore ?? 0);
  const qb = Number(b.qualityScore ?? 0);
  if (qa !== qb) return qb - qa;

  const va = toTimestamp(a.verifiedAt, "verifiedAt");
  const vb = toTimestamp(b.verifiedAt, "verifiedAt");
  if (va !== vb) return vb - va;

  return b.version.localeCompare(a.version, undefined, { numeric: true });
}

export function registerSuccessBaseline(input) {
  const id = requireString(input.id, "baseline.id");
  if (baselines.has(id)) throw new Error(`Success baseline already registered: ${id}`);
  if (input.verified !== true || input.qcPassed !== true || input.realUseSuccess !== true) {
    throw new Error("Success baseline requires verified + QC-passed + real-use success evidence.");
  }
  if (!Number.isFinite(Number(input.qualityScore))) {
    throw new Error("Success baseline requires a finite qualityScore.");
  }
  const verifiedAt = requireString(input.verifiedAt, "baseline.verifiedAt");
  toTimestamp(verifiedAt, "baseline.verifiedAt");

  const normalized = Object.freeze({
    id,
    owner: "SMILE_AI_GROUP",
    status: SUCCESS_BASELINE_STATUS.ACTIVE,
    version: requireString(input.version, "baseline.version"),
    verifiedAt,
    qualityScore: Number(input.qualityScore),
    scope: normalizeScope(input.scope),
    scopeKey: scopeKey(input.scope),
    evidenceRefs: Object.freeze([...(input.evidenceRefs || [])]),
    successMetrics: Object.freeze({ ...(input.successMetrics || {}) }),
    methodRefs: Object.freeze([...(input.methodRefs || [])]),
    supersedes: Object.freeze([...(input.supersedes || [])]),
    notes: input.notes || null,
  });
  baselines.set(id, normalized);
  return normalized;
}

export function resolveCurrentSuccessBaseline(context = {}) {
  return (
    [...baselines.values()]
      .filter((baseline) => baseline.status === SUCCESS_BASELINE_STATUS.ACTIVE)
      .filter((baseline) => matchesScope(baseline.scope, context))
      .sort(sortCurrent)[0] || null
  );
}

export function promoteSuccessBaseline(input) {
  const normalizedScope = normalizeScope(input.scope);
  const sameScope = [...baselines.values()]
    .filter((baseline) => baseline.status === SUCCESS_BASELINE_STATUS.ACTIVE)
    .filter((baseline) => baseline.scopeKey === scopeKey(normalizedScope))
    .sort(sortCurrent);

  const incumbent = sameScope[0] || null;
  if (
    incumbent &&
    Number(input.qualityScore) < Number(incumbent.qualityScore) &&
    input.allowQualityRegression !== true
  ) {
    throw new Error(
      `Candidate quality ${input.qualityScore} is below current success baseline ${incumbent.id} (${incumbent.qualityScore}).`,
    );
  }

  const promoted = registerSuccessBaseline({
    ...input,
    scope: normalizedScope,
    supersedes: [
      ...(input.supersedes || []),
      ...(incumbent ? [incumbent.id] : []),
    ],
  });

  for (const prior of sameScope) {
    baselines.set(
      prior.id,
      Object.freeze({
        ...prior,
        status: SUCCESS_BASELINE_STATUS.SUPERSEDED,
        supersededBy: promoted.id,
      }),
    );
  }

  return promoted;
}

export function retireSuccessBaseline(id, reason) {
  const baseline = baselines.get(id);
  if (!baseline) throw new Error(`Unknown success baseline: ${id}`);
  baselines.set(
    id,
    Object.freeze({
      ...baseline,
      status: SUCCESS_BASELINE_STATUS.RETIRED,
      retirementReason: requireString(reason, "retirement reason"),
    }),
  );
  return baselines.get(id);
}

export function listSuccessBaselines({ includeInactive = true } = {}) {
  const values = [...baselines.values()];
  return includeInactive
    ? values
    : values.filter((baseline) => baseline.status === SUCCESS_BASELINE_STATUS.ACTIVE);
}

export function clearSuccessBaselineRegistryForTests() {
  baselines.clear();
}

export { SUCCESS_BASELINE_STATUS };
