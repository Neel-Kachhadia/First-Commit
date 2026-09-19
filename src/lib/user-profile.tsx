"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthMethod = "email_otp" | "phone_otp" | "password";

/** Synthetic sandbox settlement account — never a real banking credential. */
export interface SyntheticAccount {
  bankName: string;
  last4: string;
  accountType: string;
}

/**
 * Principal profile — authentication data ONLY.
 * Financial authority (agents, budgets, merchants) lives in KavachStore.
 */
export interface UserProfile {
  /** Display name, used as the authority root label. */
  name: string;
  /** Login identifier for OTP / notifications. */
  email: string;
  /** Auto-generated, immutable principal ID. */
  userId: string;
  /** Optional phone number for phone-OTP. */
  phone?: string;
  /** Which credential type this principal used. */
  authMethod: AuthMethod;
  /** Sandbox settlement pool reference — NOT KYC. */
  syntheticAccount: SyntheticAccount;
}

interface UserProfileContextValue {
  profile: UserProfile;
  updateProfile: (partial: Partial<Omit<UserProfile, "userId">>) => void;
  loadPersona: (persona: "ananya" | "arnav") => void;
  regenerateUserId: () => void;
}

// ─── Seed personas ─────────────────────────────────────────────────────────────

const PERSONA_ANANYA: UserProfile = {
  name: "Ananya Iyer",
  email: "ananya@kavachpay.dev",
  userId: "usr_kvch_4417",
  phone: "+91 98765 44170",
  authMethod: "email_otp",
  syntheticAccount: {
    bankName: "HDFC Bank",
    last4: "4417",
    accountType: "Sandbox Settlement Pool",
  },
};

const PERSONA_ARNAV: UserProfile = {
  name: "Arnav Bhandari",
  email: "arnav@example.com",
  userId: "usr_kvch_7702",
  phone: "+91 98765 77020",
  authMethod: "email_otp",
  syntheticAccount: {
    bankName: "HDFC Bank",
    last4: "7702",
    accountType: "Sandbox Settlement Pool",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "kavachpay-principal-profile";

function generateUserId(): string {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `usr_kvch_${suffix}`;
}

function loadFromStorage(): UserProfile {
  if (typeof window === "undefined") return PERSONA_ANANYA;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as UserProfile;
  } catch {
    // ignore parse errors
  }
  return PERSONA_ANANYA;
}

function saveToStorage(profile: UserProfile): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore write errors (private browsing, etc.)
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(PERSONA_ANANYA);

  // Hydrate from localStorage on mount (avoids SSR mismatch).
  useEffect(() => {
    setProfile(loadFromStorage());
  }, []);

  const updateProfile = useCallback(
    (partial: Partial<Omit<UserProfile, "userId">>) => {
      setProfile((prev) => {
        const next = { ...prev, ...partial };
        saveToStorage(next);
        return next;
      });
    },
    [],
  );

  const loadPersona = useCallback((persona: "ananya" | "arnav") => {
    const next = persona === "arnav" ? PERSONA_ARNAV : PERSONA_ANANYA;
    setProfile(next);
    saveToStorage(next);
  }, []);

  const regenerateUserId = useCallback(() => {
    setProfile((prev) => {
      const next = { ...prev, userId: generateUserId() };
      saveToStorage(next);
      return next;
    });
  }, []);

  const value = useMemo<UserProfileContextValue>(
    () => ({ profile, updateProfile, loadPersona, regenerateUserId }),
    [profile, updateProfile, loadPersona, regenerateUserId],
  );

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile(): UserProfileContextValue {
  const ctx = useContext(UserProfileContext);
  if (!ctx)
    throw new Error("useUserProfile must be used within UserProfileProvider");
  return ctx;
}

/** Returns a 1-2 letter avatar abbreviation from a full name. */
export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
