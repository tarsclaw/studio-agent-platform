/**
 * src/msalValidator.ts
 *
 * Express middleware that validates Azure AD / MSAL Bearer tokens on
 * incoming dashboard API requests.
 *
 * DEPENDENCY STATUS
 * -----------------
 * AZURE_AD_TENANT_ID  — awaiting Azure AD App Registration (John Jobling / Allect IT)
 * AZURE_AD_CLIENT_ID  — awaiting Azure AD App Registration (John Jobling / Allect IT)
 *
 * If either env var is absent the middleware returns 503 with a clear, honest
 * reason.  Requests are NEVER passed through unauthenticated.
 *
 * When the App Registration is provisioned, set both env vars and token
 * validation activates automatically — no code change required.
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
  };
}

// -------------------------
// Middleware
// -------------------------

export function requireMsalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const tenantId = process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.AZURE_AD_CLIENT_ID;

  if (!tenantId || !clientId) {
    res.status(503).json({
      error: "dashboard_auth_not_configured",
      message:
        "Dashboard authentication is not yet configured. " +
        "Awaiting Azure AD App Registration credentials " +
        "(AZURE_AD_TENANT_ID + AZURE_AD_CLIENT_ID env vars). " +
        "Contact Allect IT (John Jobling) to provision the App Registration.",
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

      req.auth = {
        oid,
        tid,
        name: claims.name,
        email: claims.preferred_username ?? claims.upn,
      };

      next();
    }
  );
}
