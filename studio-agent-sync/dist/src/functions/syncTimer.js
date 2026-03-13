"use strict";
/**
 * syncTimer.ts
 * Azure Function Timer Trigger — daily identity sync at 2am UK time.
 *
 * Pulls all employees from Breathe HR and all users from Azure AD,
 * matches by email, and upserts the identity mapping into the
 * Relevance AI knowledge table (resolver_knowledge_table_with_status_csv).
 *
 * CRON: 0 0 2 * * *  (2:00 AM every day, UTC — adjust for BST if needed)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncTimerHandler = syncTimerHandler;
const functions_1 = require("@azure/functions");
const breatheService_1 = require("../services/breatheService");
const graphService_1 = require("../services/graphService");
const matchEngine_1 = require("../services/matchEngine");
const relevanceService_1 = require("../services/relevanceService");
// Needed for Graph SDK fetch calls
require("isomorphic-fetch");
async function syncTimerHandler(_timer, context) {
    const startTime = Date.now();
    context.log("=== Identity Sync Started ===");
    try {
        // 1. Pull from both sources in parallel
        context.log("Fetching Breathe employees and Azure AD users...");
        const [breatheEmployees, adUsers, existingMappings] = await Promise.all([
            (0, breatheService_1.getAllEmployees)(),
            (0, graphService_1.getAllUsers)(),
            (0, relevanceService_1.getAllMappings)(),
        ]);
        context.log(`Fetched: ${breatheEmployees.length} Breathe employees, ` +
            `${adUsers.length} AD users, ` +
            `${existingMappings.length} existing mappings`);
        // 2. Match and compute diff
        const tenantId = process.env.AZURE_TENANT_ID;
        const adminIds = (0, matchEngine_1.parseAdminIds)();
        const diff = (0, matchEngine_1.matchAndDiff)(breatheEmployees, adUsers, tenantId, existingMappings, adminIds);
        context.log(`Diff: ${diff.created.length} new, ` +
            `${diff.updated.length} updated, ` +
            `${diff.deactivated.length} deactivated, ` +
            `${diff.unmatched_breathe.length} unmatched Breathe, ` +
            `${diff.unmatched_ad.length} unmatched AD`);
        // 3. Upsert all changes
        const allChanges = [...diff.created, ...diff.updated, ...diff.deactivated];
        if (allChanges.length === 0) {
            context.log("No changes detected. Knowledge table is up to date.");
        }
        else {
            const result = await (0, relevanceService_1.upsertMappings)(allChanges);
            context.log(`Upsert complete: ${result.inserted} inserted, ` +
                `${result.updated} updated, ${result.failed} failed`);
        }
        // 4. Log unmatched for investigation
        if (diff.unmatched_breathe.length > 0) {
            context.log("Unmatched Breathe employees (no AD email match):", diff.unmatched_breathe.map((e) => `${e.first_name} ${e.last_name} <${e.email}>`));
        }
        // 5. Detect new joiners for onboarding (Phase 5)
        if (diff.created.length > 0) {
            context.log(`New joiners detected: ${diff.created.map((r) => r.employee_name).join(", ")}`);
            // TODO: Phase 5 — trigger onboarding messages for new joiners
            // For now, just log them. The onboardingTrigger function
            // will handle this when Phase 5 is activated.
        }
        const elapsed = Date.now() - startTime;
        context.log(`=== Identity Sync Complete (${elapsed}ms) ===`);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        context.error(`Identity sync FAILED: ${message}`);
        throw err; // Let Azure Functions retry logic handle it
    }
}
// Register the timer trigger
// CRON: second minute hour day month dayOfWeek
// "0 0 2 * * *" = every day at 02:00:00 UTC
functions_1.app.timer("syncTimer", {
    schedule: "0 0 2 * * *",
    handler: syncTimerHandler,
});
//# sourceMappingURL=syncTimer.js.map