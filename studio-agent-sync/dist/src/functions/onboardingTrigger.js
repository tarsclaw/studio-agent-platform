"use strict";
/**
 * onboardingTrigger.ts
 * Azure Function HTTP Trigger — called by syncTimer when new mappings are created.
 * Sends a proactive Teams welcome message to new hires.
 *
 * Phase 5 — requires:
 * - Bot deployed org-wide (Teams Admin Centre)
 * - BOT_APP_ID and BOT_APP_PASSWORD configured
 *
 * POST /api/onboardingTrigger
 * Body: { newJoiners: MappingRecord[] }
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.onboardingTriggerHandler = onboardingTriggerHandler;
const functions_1 = require("@azure/functions");
const proactiveMessaging_1 = require("../services/proactiveMessaging");
const breatheService_1 = require("../services/breatheService");
require("isomorphic-fetch");
async function onboardingTriggerHandler(req, context) {
    try {
        const body = (await req.json());
        if (!body.newJoiners || !Array.isArray(body.newJoiners)) {
            return { status: 400, body: "Expected { newJoiners: MappingRecord[] }" };
        }
        const results = [];
        for (const joiner of body.newJoiners) {
            context.log(`Onboarding: sending welcome to ${joiner.employee_name} (${joiner.aad_object_id})`);
            // Try to get department/brand from Breathe for personalisation
            let brand;
            try {
                if (joiner.breathe_employee_id) {
                    const emp = await (0, breatheService_1.getEmployee)(Number(joiner.breathe_employee_id));
                    brand = emp.department;
                }
            }
            catch {
                // Non-fatal — send generic message if Breathe lookup fails
            }
            const message = (0, proactiveMessaging_1.buildOnboardingMessage)(joiner.employee_name, brand);
            const result = await (0, proactiveMessaging_1.sendProactiveMessage)(joiner.aad_object_id, joiner.tenant_id, message);
            results.push({
                employee: joiner.employee_name,
                success: result.success,
                error: result.error,
            });
            if (result.success) {
                context.log(`✓ Welcome sent to ${joiner.employee_name}`);
            }
            else {
                context.warn(`✗ Failed to send welcome to ${joiner.employee_name}: ${result.error}`);
            }
            // Brief pause between messages
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
        const succeeded = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;
        return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                total: results.length,
                succeeded,
                failed,
                results,
            }),
        };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        context.error(`Onboarding trigger error: ${msg}`);
        return { status: 500, body: msg };
    }
}
functions_1.app.http("onboardingTrigger", {
    methods: ["POST"],
    authLevel: "function",
    handler: onboardingTriggerHandler,
});
//# sourceMappingURL=onboardingTrigger.js.map