"use strict";
/**
 * proactiveMessaging.ts
 * Bot Framework proactive messaging — sends Teams messages to users
 * without them initiating a conversation first.
 *
 * Requires:
 * - Bot deployed org-wide (via Teams Admin Centre)
 * - BOT_APP_ID and BOT_APP_PASSWORD env vars
 * - BOT_SERVICE_URL (typically https://smba.trafficmanager.net/uk/)
 *
 * Phase 5 — scaffolded, wired into onboardingTrigger.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendProactiveMessage = sendProactiveMessage;
exports.buildOnboardingMessage = buildOnboardingMessage;
const BOT_APP_ID = () => process.env.BOT_APP_ID || "";
const BOT_APP_PASSWORD = () => process.env.BOT_APP_PASSWORD || "";
const SERVICE_URL = () => process.env.BOT_SERVICE_URL || "https://smba.trafficmanager.net/uk/";
/**
 * Acquire a Bot Framework token using the bot's app credentials.
 */
async function getBotToken() {
    const res = await fetch("https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: BOT_APP_ID(),
            client_secret: BOT_APP_PASSWORD(),
            scope: "https://api.botframework.com/.default",
        }),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Bot token acquisition failed ${res.status}: ${body}`);
    }
    const data = (await res.json());
    return data.access_token;
}
/**
 * Create a 1:1 conversation with a user and send a proactive message.
 *
 * @param userAadObjectId  The Azure AD Object ID of the target user
 * @param tenantId         The tenant ID
 * @param message          The message text (supports markdown)
 */
async function sendProactiveMessage(userAadObjectId, tenantId, message) {
    if (!BOT_APP_ID() || !BOT_APP_PASSWORD()) {
        return {
            success: false,
            error: "BOT_APP_ID or BOT_APP_PASSWORD not configured",
        };
    }
    try {
        const token = await getBotToken();
        const serviceUrl = SERVICE_URL();
        // Step 1: Create a conversation with the user
        const convRes = await fetch(`${serviceUrl}v3/conversations`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                bot: { id: `28:${BOT_APP_ID()}` },
                members: [{ id: `29:${userAadObjectId}` }],
                channelData: { tenant: { id: tenantId } },
                isGroup: false,
            }),
        });
        if (!convRes.ok) {
            const body = await convRes.text().catch(() => "");
            return { success: false, error: `Create conversation failed: ${body}` };
        }
        const conv = (await convRes.json());
        // Step 2: Send the message into the conversation
        const msgRes = await fetch(`${serviceUrl}v3/conversations/${conv.id}/activities`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                type: "message",
                text: message,
            }),
        });
        if (!msgRes.ok) {
            const body = await msgRes.text().catch(() => "");
            return { success: false, error: `Send message failed: ${body}` };
        }
        return { success: true };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
    }
}
/**
 * Build a personalised onboarding welcome message.
 */
function buildOnboardingMessage(employeeName, brand) {
    const firstName = employeeName.split(" ")[0] || employeeName;
    const brandInfo = brand
        ? `You're joining the **${brand}** team — welcome aboard!`
        : "Welcome to the Allect family!";
    return [
        `👋 Hi ${firstName}! I'm **Studio Agent**, your AI assistant here at Allect.`,
        "",
        brandInfo,
        "",
        "Here are some things I can help you with right away:",
        "",
        "• **\"How do I request leave?\"** — I'll walk you through booking time off",
        "• **\"Where is my office?\"** — directions and access info for your location",
        "• **\"Who should I contact about IT?\"** — key contacts for getting set up",
        "• **\"What's in the employee handbook?\"** — policies, benefits, and more",
        "",
        "Just type a question anytime and I'll do my best to help. If I can't answer something, I'll point you to the right person.",
        "",
        "Have a great first day! 🎉",
    ].join("\n");
}
//# sourceMappingURL=proactiveMessaging.js.map