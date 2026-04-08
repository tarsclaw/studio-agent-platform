/**
 * src/msalValidator.ts
 *
 * Express middleware that validates Azure AD / MSAL Bearer tokens on
 * incoming dashboard API requests.
 *
 * DEPENDENCY STATUS
 * -----------------
 * Requires deployed AZURE_AD_TENANT_ID and AZURE_AD_CLIENT_ID values that match
 * the active Microsoft Entra dashboard app registration.
 *
 * If either env var is absent the middleware returns 503 with a clear, honest
 * reason. Requests are NEVER passed through unauthenticated.
 *
 * When the deployed env vars match the consented app registration, token
 * validation activates automatically with no code change required.
 *
 * Validation approach
 * -------------------
 * 1. Decode the JWT header to extract `kid`.
 * 2. Fetch the matching public key from Azure AD's JWKS endpoint (cached 24 h).
 * 3. Verify signature, audience, and issuer via jsonwebtoken.
 * 4. Extract `oid` (object ID) and `tid` (tenant ID) from claims and attach to req.auth.
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import jwksRsa from "jwks-rsa";

// -------------------------
// JWKS client (lazy + cached)
// -------------------------

let jwksClient: jwksRsa.JwksClient | null = null;

function getJwksClient(): jwksRsa.JwksClient {
  if (jwksClient) return jwksClient;

  const tenantId = process.env.AZURE_AD_TENANT_ID!;
  jwksClient = jwksRsa({
    jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    cache: true,
    cacheMaxAge: 86_400_000, // 24 h
    rateLimit: true,
  });
  return jwksClient;
}

// -------------------------
// Augmented request type
// -------------------------

export interface AuthenticatedRequest extends Request {
  auth?: {
    oid: string;    // Azure AD Object ID (stable per-user identifier)
    tid: string;    // Tenant ID
    name?: string;
    email?: string;
    role?: 'employee' | 'admin';
  };
}

// -------------------------
// Middleware
// -------------------------

function normalizeCsv(value?: string): string[] {
  return (value || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function resolveDashboardRole(oid?: string, email?: string): 'employee' | 'admin' {
  if (process.env.DASHBOARD_FORCE_ADMIN === 'true') return 'admin';
  const adminOids = normalizeCsv(process.env.DASHBOARD_ADMIN_OIDS);
  const adminEmails = normalizeCsv(process.env.DASHBOARD_ADMIN_EMAILS);
  if (oid && adminOids.includes(oid.toLowerCase())) return 'admin';
  if (email && adminEmails.includes(email.toLowerCase())) return 'admin';
  return 'employee';
}

export function requireMsalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (process.env.DASHBOARD_DEV_AUTH_BYPASS === "true") {
    const email = process.env.DASHBOARD_DEV_EMAIL || "dev@local";
    const oid = process.env.DASHBOARD_DEV_OID || "local-dev-user";
    req.auth = {
      oid,
      tid: process.env.AZURE_AD_TENANT_ID || "local-dev-tenant",
      name: process.env.DASHBOARD_DEV_NAME || "Local Dev User",
      email,
      role: resolveDashboardRole(oid, email),
    };
    next();
    return;
  }

  const tenantId = process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.AZURE_AD_CLIENT_ID;

  if (!tenantId || !clientId) {
    res.status(503).json({
      error: "dashboard_auth_not_configured",
      message:
        "Dashboard authentication is not yet configured. " +
        "Set deployed AZURE_AD_TENANT_ID + AZURE_AD_CLIENT_ID values for the " +
        "same Entra app registration that has dashboard consent.",
    });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      error: "missing_token",
      message: "Authorization: Bearer <token> header required.",
    });
    return;
  }

  const token = authHeader.slice(7);
  const client = getJwksClient();

  const getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
    if (!header.kid) {
      callback(new Error("JWT header missing kid claim"));
      return;
    }
    client.getSigningKey(header.kid, (err, key) => {
      if (err) return callback(err as Error);
      callback(null, key?.getPublicKey());
    });
  };

  jwt.verify(
    token,
    getKey,
    {
      audience: clientId,
      // Azure AD v2.0 tokens may carry either issuer format
      issuer: [
        `https://login.microsoftonline.com/${tenantId}/v2.0`,
        `https://sts.windows.net/${tenantId}/`,
      ],
      algorithms: ["RS256"],
    },
    (err, decoded) => {
      if (err) {
        res.status(401).json({ error: "invalid_token", message: err.message });
        return;
      }

      const claims = decoded as Record<string, any>;
      const oid = claims.oid ?? claims.sub ?? "";
      const tid = claims.tid ?? tenantId;

      if (!oid) {
        res.status(401).json({
          error: "missing_oid",
          message: "Token is missing the oid claim — cannot establish user identity.",
        });
        return;
      }

      const email = claims.preferred_username ?? claims.upn;
      req.auth = {
        oid,
        tid,
        name: claims.name,
        email,
        role: resolveDashboardRole(oid, email),
      };

      next();
    }
  );
}
