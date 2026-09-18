import type { Request, Response } from "express";
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  GlobalSignOutCommand,
  AuthFlowType,
} from "@aws-sdk/client-cognito-identity-provider";

function getRegion(): string {
  return process.env.COGNITO_REGION || process.env.AWS_REGION || "ap-south-1";
}

function getClientId(): string | undefined {
  return process.env.COGNITO_CLIENT_ID;
}

let cachedClient: CognitoIdentityProviderClient | null = null;
function getCognitoClient(): CognitoIdentityProviderClient {
  if (!cachedClient) {
    cachedClient = new CognitoIdentityProviderClient({ region: getRegion() });
  }
  return cachedClient;
}

function missingClientId(res: Response): boolean {
  const clientId = getClientId();
  if (!clientId) {
    res.status(503).json({
      success: false,
      error: "Auth service is not configured. Set COGNITO_CLIENT_ID.",
    });
    return true;
  }
  return false;
}

// ── Friendly error messages ───────────────────────────────────────────────────

function cognitoErrorMessage(err: unknown): { message: string; status: number } {
  if (err instanceof Error) {
    const name = (err as { name?: string }).name ?? "";
    switch (name) {
      case "UsernameExistsException":
        return { message: "An account with this email already exists.", status: 409 };
      case "InvalidPasswordException":
        return { message: "Password does not meet requirements.", status: 400 };
      case "CodeMismatchException":
        return { message: "Incorrect verification code.", status: 400 };
      case "ExpiredCodeException":
        return { message: "Verification code has expired. Please request a new one.", status: 400 };
      case "NotAuthorizedException":
        return { message: "Invalid email or password.", status: 401 };
      case "UserNotConfirmedException":
        return {
          message: "Email not verified. Please check your inbox for the verification code.",
          status: 403,
        };
      case "UserNotFoundException":
        return { message: "No account found with this email.", status: 404 };
      case "TooManyRequestsException":
        return { message: "Too many attempts. Please wait before trying again.", status: 429 };
      default:
        return { message: err.message || "An unexpected error occurred.", status: 500 };
    }
  }
  return { message: "An unexpected error occurred.", status: 500 };
}

// ── POST /v0/auth/register ────────────────────────────────────────────────────

/**
 * Register a new user.
 * Body: { email: string; password: string }
 * Response: { success: true; message: string }
 *
 * Cognito sends a 6-digit OTP to the email. The user must call /confirm next.
 */
export async function registerHandler(req: Request, res: Response): Promise<void> {
  if (missingClientId(res)) return;

  const { email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ success: false, error: "email and password are required." });
    return;
  }

  try {
    await getCognitoClient().send(
      new SignUpCommand({
        ClientId: getClientId()!,
        Username: email.toLowerCase().trim(),
        Password: password,
        UserAttributes: [{ Name: "email", Value: email.toLowerCase().trim() }],
      })
    );

    res.status(201).json({
      success: true,
      message:
        "Registration successful. A 6-digit verification code has been sent to your email.",
    });
  } catch (err) {
    const { message, status } = cognitoErrorMessage(err);
    res.status(status).json({ success: false, error: message });
  }
}

// ── POST /v0/auth/confirm ─────────────────────────────────────────────────────

/**
 * Confirm email with the OTP code from Cognito.
 * Body: { email: string; code: string }
 * Response: { success: true; message: string }
 */
export async function confirmHandler(req: Request, res: Response): Promise<void> {
  if (missingClientId(res)) return;

  const { email, code } = req.body ?? {};

  if (!email || !code) {
    res.status(400).json({ success: false, error: "email and code are required." });
    return;
  }

  try {
    await getCognitoClient().send(
      new ConfirmSignUpCommand({
        ClientId: getClientId()!,
        Username: email.toLowerCase().trim(),
        ConfirmationCode: String(code).trim(),
      })
    );

    res.status(200).json({
      success: true,
      message: "Email verified successfully. You may now sign in.",
    });
  } catch (err) {
    const { message, status } = cognitoErrorMessage(err);
    res.status(status).json({ success: false, error: message });
  }
}

// ── POST /v0/auth/login ───────────────────────────────────────────────────────

/**
 * Authenticate a user with email + password.
 * Body: { email: string; password: string }
 * Response: { success: true; tokens: { idToken, accessToken, refreshToken } }
 */
export async function loginHandler(req: Request, res: Response): Promise<void> {
  if (missingClientId(res)) return;

  const { email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ success: false, error: "email and password are required." });
    return;
  }

  try {
    const result = await getCognitoClient().send(
      new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: getClientId()!,
        AuthParameters: {
          USERNAME: email.toLowerCase().trim(),
          PASSWORD: password,
        },
      })
    );

    const auth = result.AuthenticationResult;
    if (!auth) {
      res.status(500).json({ success: false, error: "Authentication result was empty." });
      return;
    }

    res.status(200).json({
      success: true,
      tokens: {
        idToken: auth.IdToken,
        accessToken: auth.AccessToken,
        refreshToken: auth.RefreshToken,
      },
    });
  } catch (err) {
    const { message, status } = cognitoErrorMessage(err);
    res.status(status).json({ success: false, error: message });
  }
}

// ── POST /v0/auth/refresh ─────────────────────────────────────────────────────

/**
 * Refresh tokens using a valid refresh token.
 * Body: { refreshToken: string }
 * Response: { success: true; tokens: { idToken, accessToken } }
 */
export async function refreshHandler(req: Request, res: Response): Promise<void> {
  if (missingClientId(res)) return;

  const { refreshToken } = req.body ?? {};

  if (!refreshToken) {
    res.status(400).json({ success: false, error: "refreshToken is required." });
    return;
  }

  try {
    const result = await getCognitoClient().send(
      new InitiateAuthCommand({
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        ClientId: getClientId()!,
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      })
    );

    const auth = result.AuthenticationResult;
    if (!auth) {
      res.status(500).json({ success: false, error: "Refresh result was empty." });
      return;
    }

    res.status(200).json({
      success: true,
      tokens: {
        idToken: auth.IdToken,
        accessToken: auth.AccessToken,
      },
    });
  } catch (err) {
    const { message, status } = cognitoErrorMessage(err);
    res.status(status).json({ success: false, error: message });
  }
}

// ── POST /v0/auth/logout ──────────────────────────────────────────────────────

/**
 * Globally revoke all tokens for the authenticated user.
 * Requires: Authorization: Bearer <accessToken>   ← access token, not ID token
 * Response: { success: true; message: string }
 */
export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    res.status(400).json({ success: false, error: "Access token is required to sign out." });
    return;
  }

  try {
    await getCognitoClient().send(new GlobalSignOutCommand({ AccessToken: accessToken }));
    res.status(200).json({ success: true, message: "Signed out successfully." });
  } catch (err) {
    const { message, status } = cognitoErrorMessage(err);
    res.status(status).json({ success: false, error: message });
  }
}
