"use strict";
/**
 * graphService.ts
 * Microsoft Graph API client — pulls Azure AD user directory.
 * Uses ClientSecretCredential (application permissions, User.Read.All).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllUsers = getAllUsers;
exports.getUser = getUser;
exports.createUserSubscription = createUserSubscription;
exports.renewSubscription = renewSubscription;
const identity_1 = require("@azure/identity");
let _credential = null;
function getCredential() {
    if (!_credential) {
        const tenantId = process.env.AZURE_TENANT_ID;
        const clientId = process.env.AZURE_CLIENT_ID;
        const clientSecret = process.env.AZURE_CLIENT_SECRET;
        if (!tenantId || !clientId || !clientSecret) {
            throw new Error("Missing AZURE_TENANT_ID, AZURE_CLIENT_ID, or AZURE_CLIENT_SECRET");
        }
        _credential = new identity_1.ClientSecretCredential(tenantId, clientId, clientSecret);
    }
    return _credential;
}
async function getAccessToken() {
    const credential = getCredential();
    const tokenResponse = await credential.getToken("https://graph.microsoft.com/.default");
    if (!tokenResponse?.token) {
        throw new Error("Failed to acquire Graph API access token");
    }
    return tokenResponse.token;
}
async function graphFetch(url) {
    const token = await getAccessToken();
    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Graph API ${res.status}: ${body}`);
    }
    return res.json();
}
/**
 * Pull all users from Azure AD.
 * Handles pagination via @odata.nextLink.
 * Selects only the fields we need.
 */
async function getAllUsers() {
    const users = [];
    let url = "https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName,accountEnabled,jobTitle,department&$top=999";
    while (url) {
        const data = await graphFetch(url);
        users.push(...data.value.map((u) => ({
            id: u.id,
            displayName: u.displayName,
            mail: u.mail ? u.mail.toLowerCase().trim() : null,
            userPrincipalName: u.userPrincipalName.toLowerCase().trim(),
            accountEnabled: u.accountEnabled,
            jobTitle: u.jobTitle,
            department: u.department,
        })));
        url = data["@odata.nextLink"];
    }
    return users;
}
/**
 * Get a single user by AAD Object ID.
 * Used by webhook handler for targeted updates.
 */
async function getUser(objectId) {
    return graphFetch(`https://graph.microsoft.com/v1.0/users/${objectId}?$select=id,displayName,mail,userPrincipalName,accountEnabled,jobTitle,department`);
}
/**
 * Create a webhook subscription for /users changes.
 * The notification URL must be your deployed syncWebhook endpoint.
 */
async function createUserSubscription(notificationUrl, expirationMinutes = 4230 // ~2.9 days, max for /users
) {
    const token = await getAccessToken();
    const expiration = new Date(Date.now() + expirationMinutes * 60 * 1000).toISOString();
    const res = await fetch("https://graph.microsoft.com/v1.0/subscriptions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            changeType: "updated,deleted",
            notificationUrl,
            resource: "users",
            expirationDateTime: expiration,
            clientState: "studioAgentSync",
        }),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Graph subscription failed ${res.status}: ${body}`);
    }
    return res.json();
}
/**
 * Renew an existing subscription.
 */
async function renewSubscription(subscriptionId, expirationMinutes = 4230) {
    const token = await getAccessToken();
    const expiration = new Date(Date.now() + expirationMinutes * 60 * 1000).toISOString();
    const res = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${subscriptionId}`, {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ expirationDateTime: expiration }),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Subscription renewal failed ${res.status}: ${body}`);
    }
}
//# sourceMappingURL=graphService.js.map