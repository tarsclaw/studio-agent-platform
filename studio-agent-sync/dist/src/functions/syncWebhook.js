"use strict";
/**
 * syncWebhook.ts
 * Azure Function HTTP Trigger — receives Microsoft Graph webhook notifications
 * for /users changes (create, update, delete).
 *
 * When a user is created/updated/deleted in Azure AD, Graph sends a notification
 * here. We then do a targeted sync for just that user instead of the full list.
 *
 * Also handles the Graph validation handshake (validationToken query param).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncWebhookHandler = syncWebhookHandler;
const functions_1 = require("@azure/functions");
const graphService_1 = require("../services/graphService");
const breatheService_1 = require("../services/breatheService");
const matchEngine_1 = require("../services/matchEngine");
const relevanceService_1 = require("../services/relevanceService");
require("isomorphic-fetch");
async function syncWebhookHandler(req, context) {
    // Graph validation handshake: return the validationToken as plain text
    const validationToken = req.query.get("validationToken");
    if (validationToken) {
        context.log("Graph webhook validation handshake");
        return {
            status: 200,
            headers: { "Content-Type": "text/plain" },
            body: validationToken,
        };
    }
    // Process notifications
    try {
        const body = (await req.json());
        if (!body.value || !Array.isArray(body.value)) {
            return { status: 400, body: "Invalid notification payload" };
        }
        for (const notification of body.value) {
            // Verify client state to prevent spoofing
            if (notification.clientState !== "studioAgentSync") {
                context.warn("Invalid clientState, skipping notification");
                continue;
            }
            const userId = notification.resourceData?.id;
            if (!userId)
                continue;
            context.log(`Graph webhook: ${notification.changeType} for user ${userId}`);
            if (notification.changeType === "deleted") {
                // User deleted — deactivate their mapping
                await (0, relevanceService_1.upsertSingleMapping)({
                    tenant_id: process.env.AZURE_TENANT_ID,
                    aad_object_id: userId,
                    breathe_employee_id: "",
                    employee_name: "",
                    status: "inactive",
                    role: "employee",
                    email: "",
                    last_synced: new Date().toISOString(),
                });
                context.log(`Deactivated mapping for deleted user ${userId}`);
                continue;
            }
            // For updated (includes newly created users), do a targeted sync
            try {
                const adUser = await (0, graphService_1.getUser)(userId);
                const email = (adUser.mail || adUser.userPrincipalName).toLowerCase();
                // Find matching Breathe employee by email
                // For efficiency, we could cache this, but for webhook frequency it's fine
                const breatheEmployees = await (0, breatheService_1.getAllEmployees)();
                const match = breatheEmployees.find((e) => e.email.toLowerCase() === email);
                if (!match) {
                    context.log(`No Breathe match for AD user ${adUser.displayName} <${email}>`);
                    continue;
                }
                const adminIds = (0, matchEngine_1.parseAdminIds)();
                const breatheActive = match.status.toLowerCase() === "active";
                const status = breatheActive && adUser.accountEnabled ? "active" : "inactive";
                await (0, relevanceService_1.upsertSingleMapping)({
                    tenant_id: process.env.AZURE_TENANT_ID,
                    aad_object_id: adUser.id,
                    breathe_employee_id: String(match.id),
                    employee_name: `${match.first_name} ${match.last_name}`.trim(),
                    status,
                    role: adminIds.has(adUser.id) ? "admin" : "employee",
                    email,
                    department: match.department || adUser.department || undefined,
                    job_title: match.job_title || adUser.jobTitle || undefined,
                    last_synced: new Date().toISOString(),
                });
                context.log(`Updated mapping for ${match.first_name} ${match.last_name} (${status})`);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                context.error(`Webhook processing failed for ${userId}: ${msg}`);
            }
        }
        // Graph expects 202 Accepted
        return { status: 202 };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        context.error(`Webhook handler error: ${msg}`);
        return { status: 500, body: "Internal error" };
    }
}
functions_1.app.http("syncWebhook", {
    methods: ["POST"],
    authLevel: "anonymous", // Graph doesn't support function keys
    handler: syncWebhookHandler,
});
//# sourceMappingURL=syncWebhook.js.map