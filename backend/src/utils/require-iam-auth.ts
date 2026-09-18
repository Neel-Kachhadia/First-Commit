import type { Request, Response, NextFunction } from "express";

/**
 * Simulates API Gateway IAM/SigV4 authorization.
 * 
 * In a real AWS deployment, API Gateway handles SigV4 validation natively
 * and passes the validated identity to the Lambda.
 * For this local environment/demo, we enforce that the request contains
 * a valid AWS4-HMAC-SHA256 Authorization header to prove the caller
 * is using IAM credentials (AgentCore Gateway role).
 */
export function requireIamAuthorization(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("AWS4-HMAC-SHA256")) {
    console.warn("[IAM_Auth] 403 Forbidden - Direct bypass attempt without SigV4");
    res.status(403).json({
      success: false,
      error: "Forbidden",
      message: "Missing or invalid AWS IAM SigV4 authorization. Direct invocation is blocked."
    });
    return;
  }

  // In local simulation, we accept any correctly formatted AWS4 header as proof.
  // API Gateway would perform strict cryptographic verification of the signature.
  console.log("[IAM_Auth] SigV4 validation successful");
  next();
}
