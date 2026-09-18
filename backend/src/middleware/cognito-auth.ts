import type { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

// ── Config ────────────────────────────────────────────────────────────────────

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedIssuer: string | null = null;
let cachedPoolId: string | null = null;

function getAuthConfig() {
  const region = process.env.COGNITO_REGION || process.env.AWS_REGION || "ap-south-1";
  const userPoolId = process.env.COGNITO_USER_POOL_ID;

  if (!userPoolId) {
    return null;
  }

  if (cachedJwks && cachedIssuer && cachedPoolId === userPoolId) {
    return { jwks: cachedJwks, issuer: cachedIssuer };
  }

  const jwksUri = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
  cachedJwks = createRemoteJWKSet(new URL(jwksUri));
  cachedIssuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
  cachedPoolId = userPoolId;

  return { jwks: cachedJwks, issuer: cachedIssuer };
}

// ── Type augmentation ─────────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      /** Populated by cognitoAuthMiddleware on verified requests. */
      user?: {
        sub: string;
        email: string;
      };
    }
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────

/**
 * Validates the `Authorization: Bearer <idToken>` header against the
 * Cognito User Pool JWKS. Attaches `req.user = { sub, email }` on success.
 *
 * Returns 401 when:
 * - The header is missing or malformed.
 * - The token is expired, has a bad signature, or fails issuer check.
 * - COGNITO_USER_POOL_ID is not configured.
 */
export async function cognitoAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authConfig = getAuthConfig();
  if (!authConfig) {
    res.status(401).json({
      success: false,
      error: "Authentication is not configured on this server.",
    });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: "Missing or malformed Authorization header.",
    });
    return;
  }

  const idToken = authHeader.slice("Bearer ".length);

  try {
    const { payload } = await jwtVerify(idToken, authConfig.jwks, {
      issuer: authConfig.issuer,
      // Cognito ID tokens carry token_use: "id"
    });

    if (payload.token_use !== "id") {
      res.status(401).json({
        success: false,
        error: "Expected an ID token.",
      });
      return;
    }

    const sub = payload.sub as string;
    const email = (payload.email as string) ?? "";

    if (!sub) {
      res.status(401).json({ success: false, error: "Token missing sub claim." });
      return;
    }

    req.user = { sub, email };
    next();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Token verification failed.";
    console.warn("[cognito-auth] Token rejected:", message);
    res.status(401).json({ success: false, error: "Invalid or expired token." });
  }
}
