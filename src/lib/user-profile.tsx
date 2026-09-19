"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-context";

export interface UserProfile {
  /** Local display name, never an authentication identifier. */
  username: string;
  /** Always comes from the signed-in session. */
  email: string;
}

interface UserProfileContextValue {
  profile: UserProfile;
  updateUsername: (username: string) => void;
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null);
const storageKey = (sub: string) => `kavachpay-display-name:${sub}`;

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const sub = user?.sub ?? "";
  const email = user?.email ?? "";
  const [stored, setStored] = useState({ sub: "", username: "" });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      let username = "";
      if (sub) {
        try { username = window.localStorage.getItem(storageKey(sub)) ?? ""; } catch { /* storage unavailable */ }
      }
      setStored({ sub, username });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [sub]);

  const updateUsername = useCallback((username: string) => {
    if (!sub) return;
    const next = username.trim();
    try { window.localStorage.setItem(storageKey(sub), next); } catch { /* storage unavailable */ }
    setStored({ sub, username: next });
  }, [sub]);

  const profile = useMemo<UserProfile>(() => ({
    username: (stored.sub === sub && stored.username) || email,
    email,
  }), [stored, sub, email]);

  return <UserProfileContext.Provider value={{ profile, updateUsername }}>{children}</UserProfileContext.Provider>;
}

export function useUserProfile(): UserProfileContextValue {
  const context = useContext(UserProfileContext);
  if (!context) throw new Error("useUserProfile must be used within UserProfileProvider");
  return context;
}

export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "KP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
