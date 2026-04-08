import { PublicClientApplication, type AccountInfo, type AuthenticationResult, BrowserCacheLocation } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_AZURE_AD_CLIENT_ID as string | undefined;
const tenantId = import.meta.env.VITE_AZURE_AD_TENANT_ID as string | undefined;
const apiScope = import.meta.env.VITE_AZURE_AD_API_SCOPE as string | undefined;

export const msalEnabled = Boolean(clientId && tenantId);

const configuredRedirectUri = import.meta.env.VITE_AZURE_AD_REDIRECT_URI as string | undefined;
const currentOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
const canonicalRedirectOrigin =
  currentOrigin === 'https://www.mystudioagent.ai' ? 'https://mystudioagent.ai' : currentOrigin;
const redirectUri = canonicalRedirectOrigin || configuredRedirectUri || window.location.origin;

export const msalConfig = msalEnabled
  ? {
      auth: {
        clientId: clientId!,
        authority: `https://login.microsoftonline.com/${tenantId!}`,
        redirectUri,
      },
      cache: {
        cacheLocation: BrowserCacheLocation.SessionStorage,
      },
    }
  : null;

export const loginRequest = {
  scopes: apiScope ? [apiScope] : ['User.Read'],
};

let app: PublicClientApplication | null = null;
let initialized = false;

export async function getMsalApp(): Promise<PublicClientApplication | null> {
  if (!msalConfig) return null;
  if (!app) app = new PublicClientApplication(msalConfig);
  if (!initialized) {
    await app.initialize();
    initialized = true;
    await app.handleRedirectPromise().catch(() => null);
  }
  return app;
}

export async function getActiveAccount(): Promise<AccountInfo | null> {
  const msal = await getMsalApp();
  if (!msal) return null;
  const active = msal.getActiveAccount();
  if (active) return active;
  const all = msal.getAllAccounts();
  if (all[0]) {
    msal.setActiveAccount(all[0]);
    return all[0];
  }
  return null;
}

export async function loginWithMsal(): Promise<void> {
  const msal = await getMsalApp();
  if (!msal) return;
  await msal.loginRedirect(loginRequest);
}

export async function acquireAccessToken(): Promise<string | null> {
  const msal = await getMsalApp();
  if (!msal) return null;

  let account = await getActiveAccount();
  if (!account) {
    await loginWithMsal();
    return null;
  }

  try {
    const result: AuthenticationResult = await msal.acquireTokenSilent({
      ...loginRequest,
      account,
    });
    if (result.account) msal.setActiveAccount(result.account);
    return result.accessToken;
  } catch {
    await msal.acquireTokenRedirect({ ...loginRequest, account });
    return null;
  }
}
