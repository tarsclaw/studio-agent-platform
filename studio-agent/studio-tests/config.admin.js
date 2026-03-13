// ============================================================
//  studio-tests/config.admin.js
//  Admin-specific config overrides — sits alongside config.js
//  Imports the shared base and overrides agent ID + identities.
// ============================================================

export {
  BREATHE, RELEVANCE_BASE, RELEVANCE_AUTH,
  AGENT_TIMEOUT_MS, AGENT_POLL_MS, AGENT_SETTLE_MS,
  c, banner, dateStr, extractFirstId, makeResultStore,
} from "./config.js";

import { RELEVANCE as _REL, RESOLVER_TEST as _RES } from "./config.js";

// ── Override agent to the ADMIN agent ────────────────────────
export const RELEVANCE = {
  ..._REL,
  AGENT_ID: process.env.RELEVANCE_ADMIN_AGENT_ID
    || "540367c8-180d-4ed1-8eb0-eac213535433",
};

// ── Admin test identity (Maddox Rigby) ──────────────────────
export const ADMIN_TEST = {
  TENANT_ID:     "allect",
  AAD_OBJECT_ID: process.env.ADMIN_AAD_OBJECT_ID
    || "81143a8a-a44e-4ca9-941e-341befa6eff2",
  BREATHE_ID:    "9811",
  NAME:          "Maddox Rigby",
};

// ── Employee test identity (Iain Johnson) ───────────────────
export const EMPLOYEE_TEST = {
  TENANT_ID:     "allect",
  AAD_OBJECT_ID: process.env.EMPLOYEE_AAD_OBJECT_ID
    || "06c18e13-de0f-4858-933a-a45792d8a728",
  BREATHE_ID:    "1746791",
  NAME:          "Iain Johnson",
};

// ── Unknown / unlinked user identity ────────────────────────
export const UNKNOWN_TEST = {
  TENANT_ID:     "allect",
  AAD_OBJECT_ID: "00000000-0000-0000-0000-000000000000",
  BREATHE_ID:    null,
  NAME:          "Unknown User",
};
