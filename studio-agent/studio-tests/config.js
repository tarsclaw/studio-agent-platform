// ============================================================
//  studio-tests/config.js
//  Single source of truth for all test suite constants.
//  Edit RELEVANCE_REGION and TEST_AAD_OBJECT_ID before running.
// ============================================================

export const BREATHE = {
  BASE_URL: process.env.BREATHE_BASE_URL ||
    (process.env.BREATHE_API_KEY?.startsWith("sandbox-")
      ? "https://api.sandbox.breathehr.info"
      : "https://api.breathehr.com"),
  API_KEY:  process.env.BREATHE_API_KEY || "",
};

export const RELEVANCE = {
  // Stack region prefix — visible in Relevance AI URL: app.relevanceai.com/notebook/bcbe5a/...
  REGION_STACK: process.env.RELEVANCE_REGION_STACK || "bcbe5a",
  API_KEY:      process.env.RELEVANCE_API_KEY   || "",   // required for Layer 2 + 3
  PROJECT_ID:   process.env.RELEVANCE_PROJECT_ID || "ca7f193a-f48c-41ab-8c3e-6833ec9a5001",
  AGENT_ID:     process.env.RELEVANCE_AGENT_ID   || "b2be3164-2f80-4de8-a8bf-9aa97f04dd8d",
};

// Full Relevance AI REST base URL (derived from region stack)
export const RELEVANCE_BASE = `https://api-${RELEVANCE.REGION_STACK}.stack.tryrelevance.com/latest`;

// Authorization header value for Relevance AI REST calls
export const RELEVANCE_AUTH = `${RELEVANCE.PROJECT_ID}:${RELEVANCE.API_KEY}`;

// ── RESOLVER TEST IDENTITY ────────────────────────────────────
// Set TEST_AAD_OBJECT_ID to YOUR real Azure AD Object ID so Layer 2/3
// resolver tests use a known identity that exists in resolver_knowledge_table_with_status_csv
export const RESOLVER_TEST = {
  TENANT_ID:     process.env.TEST_TENANT_ID     || "allect",
  AAD_OBJECT_ID: process.env.TEST_AAD_OBJECT_ID || "",   // MUST be set for Layer 2/3
  // Expected breathe_employee_id that should come back for the above identity
  EXPECTED_EMPLOYEE_ID: process.env.TEST_EXPECTED_EMPLOYEE_ID || "",
};

// ── AGENT CONVERSATION TIMEOUT ───────────────────────────────
export const AGENT_TIMEOUT_MS  = 90_000;   // max wait for agent reply
export const AGENT_POLL_MS     = 2_000;    // polling interval
export const AGENT_SETTLE_MS   = 1_500;    // settle after last message

// ── COLOUR HELPERS ────────────────────────────────────────────
export const c = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  green: "\x1b[32m", red: "\x1b[31m", yellow: "\x1b[33m",
  cyan: "\x1b[36m",  blue: "\x1b[34m", grey: "\x1b[90m",
  magenta: "\x1b[35m", white: "\x1b[37m",
};

// ── SHARED UTILITIES ─────────────────────────────────────────
export function banner(title, sub = "") {
  console.log(`\n${c.blue}${c.bold}${"━".repeat(62)}${c.reset}`);
  console.log(`${c.blue}${c.bold}  ${title}${c.reset}${sub ? `  ${c.grey}${sub}${c.reset}` : ""}`);
  console.log(`${c.blue}${"━".repeat(62)}${c.reset}`);
}

export function dateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

export function extractFirstId(data) {
  const candidates = [
    data?.employees, data?.leave_requests, data?.absences,
    data?.change_requests, data?.bonuses, data?.sicknesses,
    data?.holiday_allowances, data?.departments,
  ];
  for (const arr of candidates) {
    if (Array.isArray(arr) && arr.length > 0) return arr[0]?.id ?? null;
  }
  if (Array.isArray(data) && data.length > 0) return data[0]?.id ?? null;
  return null;
}

// Shared result accumulator factory
export function makeResultStore() {
  const results = [];
  return {
    results,
    push: (r) => results.push(r),
    summary() {
      const passed  = results.filter(r => r.status === "PASS").length;
      const failed  = results.filter(r => r.status === "FAIL").length;
      const skipped = results.filter(r => r.status === "SKIP").length;
      const warned  = results.filter(r => r.status === "WARN").length;
      return { passed, failed, skipped, warned, total: results.length };
    },
  };
}
