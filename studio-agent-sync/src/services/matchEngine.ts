/**
 * matchEngine.ts
 * Matches Breathe HR employees to Azure AD users by email.
 * Produces upsert records for the Relevance AI knowledge table.
 */

import type { BreatheEmployee } from "./breatheService";
import type { GraphUser } from "./graphService";

export interface MappingRecord {
  tenant_id: string;
  aad_object_id: string;
  breathe_employee_id: string;     // stored as string in the knowledge table
  employee_name: string;
  status: "active" | "inactive";
  role: "employee" | "admin";
  email: string;
  department?: string;
  job_title?: string;
  last_synced: string;             // ISO timestamp
}

export interface SyncDiff {
  created: MappingRecord[];
  updated: MappingRecord[];
  deactivated: MappingRecord[];
  unmatched_breathe: BreatheEmployee[];   // in Breathe but no AD match
  unmatched_ad: GraphUser[];              // in AD but no Breathe match
}

/**
 * Core matching logic.
 *
 * @param breatheEmployees  All employees from Breathe HR
 * @param adUsers           All users from Azure AD
 * @param tenantId          The Azure AD tenant ID
 * @param existingMappings  Current records in the knowledge table (for diff)
 * @param adminObjectIds    AAD object IDs that should have role="admin"
 */
export function matchAndDiff(
  breatheEmployees: BreatheEmployee[],
  adUsers: GraphUser[],
  tenantId: string,
  existingMappings: MappingRecord[],
  adminObjectIds: Set<string>
): SyncDiff {
  const now = new Date().toISOString();

  // Index AD users by email (both mail and UPN)
  const adByEmail = new Map<string, GraphUser>();
  for (const user of adUsers) {
    if (user.mail) {
      adByEmail.set(user.mail.toLowerCase(), user);
    }
    // UPN as fallback — some users have mail === null
    const upnLower = user.userPrincipalName.toLowerCase();
    if (!adByEmail.has(upnLower)) {
      adByEmail.set(upnLower, user);
    }
  }

  // Index existing mappings by aad_object_id for diff comparison
  const existingByAad = new Map<string, MappingRecord>();
  for (const m of existingMappings) {
    existingByAad.set(m.aad_object_id, m);
  }

  // Track which AD users got matched (to find unmatched AD users later)
  const matchedAdIds = new Set<string>();

  const created: MappingRecord[] = [];
  const updated: MappingRecord[] = [];
  const unmatchedBreathe: BreatheEmployee[] = [];

  for (const emp of breatheEmployees) {
    const email = emp.email.toLowerCase().trim();
    if (!email) {
      unmatchedBreathe.push(emp);
      continue;
    }

    const adUser = adByEmail.get(email);
    if (!adUser) {
      unmatchedBreathe.push(emp);
      continue;
    }

    matchedAdIds.add(adUser.id);

    // Determine status: active only if BOTH systems say active
    const breatheActive = emp.status.toLowerCase() === "active";
    const adActive = adUser.accountEnabled;
    const status: "active" | "inactive" =
      breatheActive && adActive ? "active" : "inactive";

    // Determine role
    const role: "employee" | "admin" = adminObjectIds.has(adUser.id)
      ? "admin"
      : "employee";

    const record: MappingRecord = {
      tenant_id: tenantId,
      aad_object_id: adUser.id,
      breathe_employee_id: String(emp.id),
      employee_name: `${emp.first_name} ${emp.last_name}`.trim(),
      status,
      role,
      email,
      department: emp.department || adUser.department || undefined,
      job_title: emp.job_title || adUser.jobTitle || undefined,
      last_synced: now,
    };

    const existing = existingByAad.get(adUser.id);
    if (!existing) {
      created.push(record);
    } else if (hasChanged(existing, record)) {
      updated.push(record);
    }
    // If nothing changed, skip (no upsert needed)
  }

  // Find AD users that were previously mapped but no longer match any Breathe employee
  // (e.g. their Breathe account was deleted or email changed)
  const deactivated: MappingRecord[] = [];
  for (const existing of existingMappings) {
    if (
      existing.status === "active" &&
      !matchedAdIds.has(existing.aad_object_id)
    ) {
      deactivated.push({
        ...existing,
        status: "inactive",
        last_synced: now,
      });
    }
  }

  // Find AD users with no Breathe match
  const unmatchedAd = adUsers.filter((u) => !matchedAdIds.has(u.id));

  return {
    created,
    updated,
    deactivated,
    unmatched_breathe: unmatchedBreathe,
    unmatched_ad: unmatchedAd,
  };
}

/**
 * Check if a mapping record has changed in a way that requires an upsert.
 */
function hasChanged(old: MappingRecord, fresh: MappingRecord): boolean {
  return (
    old.status !== fresh.status ||
    old.role !== fresh.role ||
    old.employee_name !== fresh.employee_name ||
    old.breathe_employee_id !== fresh.breathe_employee_id ||
    old.email !== fresh.email ||
    old.department !== fresh.department ||
    old.job_title !== fresh.job_title
  );
}

/**
 * Parse the ADMIN_AAD_OBJECT_IDS env var (comma-separated).
 */
export function parseAdminIds(): Set<string> {
  const raw = process.env.ADMIN_AAD_OBJECT_IDS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}
