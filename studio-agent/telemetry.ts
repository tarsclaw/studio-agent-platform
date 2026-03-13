// telemetry.ts
import * as appInsights from "applicationinsights";
import crypto from "crypto";

type Props = Record<string, string>;
type Measurements = Record<string, number>;

let client: any = null;

function safeStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * Hashes tenant + user so you never store raw IDs in telemetry.
 * Supports BOTH calling styles:
 *  - hashUser(tenantId, aadObjectId)
 *  - hashUser("tenantId:aadObjectId")  (or any single composite string)
 *
 * Uses TELEMETRY_HASH_SALT if provided (recommended).
 */
export function hashUser(a: string, b?: string): string {
  const salt = process.env.TELEMETRY_HASH_SALT || "";
  const raw = b !== undefined ? `${a}:${b}` : a;
  return crypto.createHash("sha256").update(`${salt}:${raw}`).digest("hex");
}

/**
 * Initialize Application Insights once, at process startup.
 * Reads APPLICATIONINSIGHTS_CONNECTION_STRING from env.
 *
 * IMPORTANT: must NEVER throw (otherwise your bot crashes on startup).
 */
export function initTelemetry() {
  const cs =
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ||
    process.env.APPLICATIONINSIGHTS_CONNECTIONSTRING ||
    "";

  if (!cs) {
    console.warn(
      "[telemetry] No APPLICATIONINSIGHTS_CONNECTION_STRING set. Telemetry disabled."
    );
    client = null;
    return null;
  }

  try {
    const ai: any = appInsights as any;

    // Some SDK versions return a chain object from setup(); some don't.
    const chain: any = typeof ai.setup === "function" ? ai.setup(cs) : null;

    const callIfExists = (fnName: string, ...args: any[]) => {
      const fn =
        (chain && typeof chain[fnName] === "function" && chain[fnName]) ||
        (typeof ai[fnName] === "function" && ai[fnName]) ||
        null;

      if (!fn) return;

      try {
        fn.apply(chain || ai, args);
      } catch (e) {
        console.warn(`[telemetry] ${fnName} failed (ignored):`, safeStr(e));
      }
    };

    // These are optional across versions. Only call if present.
    callIfExists("setAutoCollectRequests", true);
    callIfExists("setAutoCollectDependencies", true);
    callIfExists("setAutoCollectExceptions", true);
    callIfExists("setAutoCollectPerformance", true);
    callIfExists("setAutoCollectConsole", true);

    // Start (may exist on chain or module depending on version)
    if (chain && typeof chain.start === "function") chain.start();
    else if (typeof ai.start === "function") ai.start();

    client = ai.defaultClient || chain?.defaultClient || null;

    console.log("[telemetry] Application Insights initialized.");
    return client;
  } catch (e) {
    console.error("[telemetry] Init failed; telemetry disabled:", safeStr(e));
    client = null;
    return null;
  }
}

/**
 * Supports BOTH calling styles:
 * 1) trackEvent({ name, properties, measurements })
 * 2) trackEvent("name", properties, measurements?)
 */
export function trackEvent(
  nameOrParams:
    | string
    | { name: string; properties?: Props; measurements?: Measurements },
  properties?: Props,
  measurements?: Measurements
) {
  if (!client) return;

  if (typeof nameOrParams === "string") {
    client.trackEvent({
      name: nameOrParams,
      properties,
      measurements,
    });
    return;
  }

  client.trackEvent({
    name: nameOrParams.name,
    properties: nameOrParams.properties,
    measurements: nameOrParams.measurements,
  });
}

export function trackDependency(params: {
  name: string;
  target?: string;
  durationMs: number;
  success: boolean;
  resultCode?: string;
  properties?: Props;
}) {
  if (!client) return;

  client.trackDependency({
    dependencyTypeName: "custom",
    name: params.name,
    target: params.target || "unknown",
    duration: params.durationMs,
    success: params.success,
    resultCode: params.resultCode || "",
    properties: params.properties,
  });
}

export function trackException(err: unknown, properties?: Props) {
  if (!client) return;
  const exception = err instanceof Error ? err : new Error(safeStr(err));
  client.trackException({ exception, properties });
}
