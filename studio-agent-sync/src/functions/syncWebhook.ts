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

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getUser } from "../services/graphService";
import { getAllEmployees } from "../services/breatheService";
import { parseAdminIds } from "../services/matchEngine";
import { upsertSingleMapping } from "../services/relevanceService";

import "isomorphic-fetch";

interface GraphNotification {
  value: Array<{
    subscriptionId: string;
    clientState: string;
    changeType: "updated" | "deleted";
    resource: string;
    resourceData: {
      id: string;
      "@odata.type": string;
    };
  }>;
}

export async function syncWebhookHandler(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
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
    const body = (await req.json()) as GraphNotification;

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
      if (!userId) continue;

      context.log(
        `Graph webhook: ${notification.changeType} for user ${userId}`
      );

      if (notification.changeType === "deleted") {
        // User deleted — deactivate their mapping
        await upsertSingleMapping({
          tenant_id: process.env.AZURE_TENANT_ID!,
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
        const adUser = await getUser(userId);
        const email = (adUser.mail || adUser.userPrincipalName).toLowerCase();

        // Find matching Breathe employee by email
        // For efficiency, we could cache this, but for webhook frequency it's fine
        const breatheEmployees = await getAllEmployees();
        const match = breatheEmployees.find(
          (e) => e.email.toLowerCase() === email
        );

        if (!match) {
          context.log(
            `No Breathe match for AD user ${adUser.displayName} <${email}>`
          );
          continue;
        }

        const adminIds = parseAdminIds();
        const breatheActive = match.status.toLowerCase() === "active";
        const status = breatheActive && adUser.accountEnabled ? "active" : "inactive";

        await upsertSingleMapping({
          tenant_id: process.env.AZURE_TENANT_ID!,
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

        context.log(
          `Updated mapping for ${match.first_name} ${match.last_name} (${status})`
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        context.error(`Webhook processing failed for ${userId}: ${msg}`);
      }
    }

    // Graph expects 202 Accepted
    return { status: 202 };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    context.error(`Webhook handler error: ${msg}`);
    return { status: 500, body: "Internal error" };
  }
}

app.http("syncWebhook", {
  methods: ["POST"],
  authLevel: "anonymous", // Graph doesn't support function keys
  handler: syncWebhookHandler,
});
