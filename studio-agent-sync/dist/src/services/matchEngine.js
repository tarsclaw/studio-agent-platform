"use strict";
/**
 * matchEngine.ts
 * Matches Breathe HR employees to Azure AD users by email.
 * Produces upsert records for the Relevance AI knowledge table.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchAndDiff = matchAndDiff;
exports.parseAdminIds = parseAdminIds;
/**
 * Core matching logic.
 *
 * @param breatheEmployees  All employees from Breathe HR
 * @param adUsers           All users from Azure AD
 * @param tenantId          The Azure AD tenant ID
 * @param existingMappings  Current records in the knowledge table (for diff)
 * @param adminObjectIds    AAD object IDs that should have role="admin"
 */
function matchAndDiff(breatheEmployees, adUsers, tenantId, existingMappings, adminObjectIds) {
    const now = new Date().toISOString();
    // Index AD users by email (both mail and UPN)
    const adByEmail = new Map();
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
    const existingByAad = new Map();
    for (const m of existingMappings) {
        existingByAad.set(m.aad_object_id, m);
    }
    // Track which AD users got matched (to find unmatched AD users later)
    const matchedAdIds = new Set();
    const created = [];
    const updated = [];
    const unmatchedBreathe = [];
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
        const status = breatheActive && adActive ? "active" : "inactive";
        // Determine role
        const role = adminObjectIds.has(adUser.id)
            ? "admin"
            : "employee";
        const record = {
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
        }
        else if (hasChanged(existing, record)) {
            updated.push(record);
        }
        // If nothing changed, skip (no upsert needed)
    }
    // Find AD users that were previously mapped but no longer match any Breathe employee
    // (e.g. their Breathe account was deleted or email changed)
    const deactivated = [];
    for (const existing of existingMappings) {
        if (existing.status === "active" &&
            !matchedAdIds.has(existing.aad_object_id)) {
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
function hasChanged(old, fresh) {
    return (old.status !== fresh.status ||
        old.role !== fresh.role ||
        old.employee_name !== fresh.employee_name ||
        old.breathe_employee_id !== fresh.breathe_employee_id ||
        old.email !== fresh.email ||
        old.department !== fresh.department ||
        old.job_title !== fresh.job_title);
}
/**
 * Parse the ADMIN_AAD_OBJECT_IDS env var (comma-separated).
 */
function parseAdminIds() {
    const raw = process.env.ADMIN_AAD_OBJECT_IDS || "";
    return new Set(raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean));
}
//# sourceMappingURL=matchEngine.js.map