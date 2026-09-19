"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  signIn,
  signUp,
  signOut,
  confirmSignUp,
  getCurrentUser,
  fetchAuthSession,
  resendSignUpCode,
  type SignInOutput,
  type SignUpOutput,
} from "aws-amplify/auth";
import { configureAmplify } from "./amplify-config";

// Ensure Amplify is initialized on the client side before any auth service call
configureAmplify();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  sub: string;
  email: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  /** Sign up a new user. Cognito sends a 6-digit verification code to email. */
  register: (email: string, password: string) => Promise<SignUpOutput>;

  /** Confirm the 6-digit OTP code sent to the user's email after sign-up. */
  confirm: (email: string, code: string) => Promise<void>;

  /** Resend the verification code (e.g., if it expired). */
  resendCode: (email: string) => Promise<void>;

  /** Sign in an already-verified user and refresh auth state. */
  login: (email: string, password: string) => Promise<SignInOutput>;

  /** Sign out the current user and clear auth state. */
  logout: () => Promise<void>;

  /**
   * Returns the current Cognito ID token string.
   * Use as `Authorization: Bearer <token>` in API calls.
   */
  getIdToken: () => Promise<string | null>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /** Hydrate session from Amplify storage on mount. */
  useEffect(() => {
    async function hydrate() {
      try {
        const cognitoUser = await getCurrentUser();
        const session = await fetchAuthSession();
        const payload = session.tokens?.idToken?.payload;
        setUser({
          sub: cognitoUser.userId,
          email: (payload?.email as string) ?? cognitoUser.signInDetails?.loginId ?? "",
        });
      } catch {
        // No active session — user is logged out.
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    hydrate();
  }, []);

  const register = useCallback(
    async (email: string, password: string) => {
      return signUp({
        username: email.toLowerCase().trim(),
        password,
        options: {
          userAttributes: { email: email.toLowerCase().trim() },
        },
      });
    },
    []
  );

  const confirm = useCallback(async (email: string, code: string) => {
    await confirmSignUp({
      username: email.toLowerCase().trim(),
      confirmationCode: code.trim(),
    });
  }, []);

  const resendCode = useCallback(async (email: string) => {
    await resendSignUpCode({ username: email.toLowerCase().trim() });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await signIn({
      username: email.toLowerCase().trim(),
      password,
    });

    // Refresh local user state after successful sign-in.
    if (result.isSignedIn) {
      const cognitoUser = await getCurrentUser();
      const session = await fetchAuthSession();
      const payload = session.tokens?.idToken?.payload;
      setUser({
        sub: cognitoUser.userId,
        email: (payload?.email as string) ?? email.toLowerCase().trim(),
      });
    }

    return result;
  }, []);

  const logout = useCallback(async () => {
    await signOut({ global: true });
    setUser(null);
  }, []);

  const getIdToken = useCallback(async (): Promise<string | null> => {
    try {
      const session = await fetchAuthSession({ forceRefresh: false });
      return session.tokens?.idToken?.toString() ?? null;
    } catch {
      return null;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: user !== null,
        register,
        confirm,
        resendCode,
        login,
        logout,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Access authentication state and helpers from any client component.
 *
 * @throws if called outside of <AuthProvider>
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
