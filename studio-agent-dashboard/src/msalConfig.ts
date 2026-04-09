import { PublicClientApplication, type AccountInfo, type AuthenticationResult, BrowserCacheLocation } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_AZURE_AD_CLIENT_ID as string | undefined;
const tenantId = import.meta.env.VITE_AZURE_AD_TENANT_ID as string | undefined;
const apiScope = import.meta.env.VITE_AZURE_AD_API_SCOPE as string | undefined;
const authMode = (import.meta.env.VITE_AUTH_MODE as string | undefined)?.toLowerCase();

export const msalEnabled = authMode === 'msal' && Boolean(clientId && tenantId);

const configuredRedirectUri = import.meta.env.VITE_AZURE_AD_REDIRECT_URI as string | undefined;
const redirectUri =
  typeof window !== 'undefined' && window.location.hostname === 'www.mystudioagent.ai'
    ? window.location.origin
    : configuredRedirectUri || window.location.origin;

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
let redirectHandled = false;
let redirectInFlight = false;
const LOGIN_ATTEMPT_KEY = 'studio_agent_msal_login_started';
const LOGIN_ATTEMPT_AT_KEY = 'studio_agent_msal_login_started_at';
const LOGIN_ATTEMPT_STALE_MS = 2 * 60 * 1000;

function clearLoginAttempt(): void {
  try {
    sessionStorage.removeItem(LOGIN_ATTEMPT_KEY);
    sessionStorage.removeItem(LOGIN_ATTEMPT_AT_KEY);
  } catch {}
}

function markLoginAttempt(): void {
  try {
    sessionStorage.setItem(LOGIN_ATTEMPT_KEY, 'true');
    sessionStorage.setItem(LOGIN_ATTEMPT_AT_KEY, String(Date.now()));
  } catch {}
}

function hasFreshLoginAttempt(): boolean {
  try {
    if (sessionStorage.getItem(LOGIN_ATTEMPT_KEY) !== 'true') return false;
    const raw = sessionStorage.getItem(LOGIN_ATTEMPT_AT_KEY);
    const startedAt = raw ? Number(raw) : NaN;
    if (!Number.isFinite(startedAt)) return true;
    if (Date.now() - startedAt > LOGIN_ATTEMPT_STALE_MS) {
      clearLoginAttempt();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function getMsalApp(): Promise<PublicClientApplication | null> {
  if (!msalConfig) return null;
  if (!app) app = new PublicClientApplication(msalConfig);
  if (!initialized) {
    await app.initialize();
    initialized = true;
  }
  if (!redirectHandled) {
    redirectInFlight = true;
    const redirectResult = await app.handleRedirectPromise().catch(() => null);
    if (redirectResult?.account) {
      app.setActiveAccount(redirectResult.account);
    }
    clearLoginAttempt();
    redirectHandled = true;
    redirectInFlight = false;
  }
  return app;
}

export async function isMsalInteractionInProgress(): Promise<boolean> {
  const msal = await getMsalApp();
  if (!msal) return false;
  return (redirectInFlight || hasFreshLoginAttempt()) && msal.getAllAccounts().length === 0;
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
  if (redirectInFlight) return;
  markLoginAttempt();
  redirectInFlight = true;
  await msal.loginRedirect(loginRequest);
}

export async function acquireAccessToken(options?: { interactive?: boolean }): Promise<string | null> {
  const msal = await getMsalApp();
  if (!msal) return null;

  const interactive = options?.interactive ?? true;
  const account = await getActiveAccount();
  if (!account) {
    if (interactive) {
      await loginWithMsal();
    }
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
    if (interactive && !redirectInFlight) {
      markLoginAttempt();
      redirectInFlight = true;
      await msal.acquireTokenRedirect({ ...loginRequest, account });
    }
    return null;
  }
}
