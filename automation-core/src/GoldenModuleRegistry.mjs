const GOLDEN_MODULE_STATUS = Object.freeze({
  VERIFIED: "VERIFIED",
  RETIRED: "RETIRED",
});

const registry = new Map();

function assertNonEmpty(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

export function registerGoldenModule(module) {
  const id = assertNonEmpty(module.id, "module.id");
  if (registry.has(id)) {
    throw new Error(`Golden module already registered: ${id}`);
  }
  if (module.status !== GOLDEN_MODULE_STATUS.VERIFIED) {
    throw new Error("Only VERIFIED modules may enter the Golden Registry.");
  }
  if (!Array.isArray(module.capabilities) || module.capabilities.length === 0) {
    throw new Error("Golden module requires at least one capability.");
  }
  if (!Array.isArray(module.accepts) || module.accepts.length === 0) {
    throw new Error("Golden module requires accepted input classes.");
  }
  if (!Array.isArray(module.produces) || module.produces.length === 0) {
    throw new Error("Golden module requires produced output classes.");
  }
  const normalized = Object.freeze({
    ...module,
    id,
    owner: "SMILE_AI_GROUP",
    status: GOLDEN_MODULE_STATUS.VERIFIED,
    version: assertNonEmpty(module.version, "module.version"),
    capabilities: Object.freeze([...new Set(module.capabilities)]),
    accepts: Object.freeze([...new Set(module.accepts)]),
    produces: Object.freeze([...new Set(module.produces)]),
    constraints: Object.freeze({ ...(module.constraints || {}) }),
  });
  registry.set(id, normalized);
  return normalized;
}

export function getGoldenModule(id) {
  return registry.get(id) || null;
}

export function listGoldenModules() {
  return [...registry.values()];
}

export function findGoldenModules({
  capability,
  accepts,
  produces,
  serviceScope,
} = {}) {
  return listGoldenModules().filter((module) => {
    if (capability && !module.capabilities.includes(capability)) return false;
    if (accepts && !module.accepts.includes(accepts)) return false;
    if (produces && !module.produces.includes(produces)) return false;
    if (
      serviceScope &&
      Array.isArray(module.constraints.serviceScopes) &&
      !module.constraints.serviceScopes.includes(serviceScope)
    ) {
      return false;
    }
    return true;
  });
}

export function clearGoldenModuleRegistryForTests() {
  registry.clear();
}

export { GOLDEN_MODULE_STATUS };
