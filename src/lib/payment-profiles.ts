"use client";

/**
 * Shared payment-profile query and mutation hooks.
 *
 * All surfaces (Payment Methods page, Dashboard PaymentSetupCard,
 * Mandate Studio Review step) MUST use this module — do NOT create
 * separate query implementations.
 *
 * Query key: ["payment-profiles"]
 *
 * After successful create or disable, invalidate ["payment-profiles"]
 * so all subscribers re-fetch automatically.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  apiClient,
  type PaymentProfile,
  type CreatePaymentProfilePayload,
} from "./api-client";

export const PAYMENT_PROFILES_QUERY_KEY = ["payment-profiles"] as const;

// ── Queries ────────────────────────────────────────────────────────────────────

/**
 * Returns all payment profiles for the authenticated user.
 * Used by Payment Methods page, Dashboard card, and Mandate Studio.
 */
export function usePaymentProfiles() {
  return useQuery<PaymentProfile[]>({
    queryKey: PAYMENT_PROFILES_QUERY_KEY,
    queryFn: () => apiClient.getPaymentProfiles(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

/**
 * Returns only ACTIVE profiles.
 * Derived from usePaymentProfiles — same cache, no extra fetch.
 */
export function useActivePaymentProfiles(): {
  profiles: PaymentProfile[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
} {
  const { data, isLoading, isError, error } = usePaymentProfiles();
  return {
    profiles: (data ?? []).filter((p) => p.status === "ACTIVE"),
    isLoading,
    isError,
    error: error as Error | null,
  };
}

// ── Mutations ──────────────────────────────────────────────────────────────────

/**
 * Creates a simulated Razorpay TEST payment profile.
 * On success, invalidates ["payment-profiles"] so all subscribers refetch.
 */
export function useCreatePaymentProfile() {
  const queryClient = useQueryClient();

  return useMutation<PaymentProfile, Error, CreatePaymentProfilePayload>({
    mutationFn: (payload) => apiClient.createPaymentProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_PROFILES_QUERY_KEY });
    },
  });
}

/**
 * Disables a payment profile by ID.
 * On success, invalidates ["payment-profiles"] so all subscribers refetch.
 */
export function useDisablePaymentProfile() {
  const queryClient = useQueryClient();

  return useMutation<PaymentProfile, Error, string>({
    mutationFn: (id) => apiClient.disablePaymentProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENT_PROFILES_QUERY_KEY });
    },
  });
}

// ── Utilities ──────────────────────────────────────────────────────────────────

/**
 * Counts the number of ROOT grants directly bound to a specific profile.
 *
 * A root grant is one where parentGrantId is undefined/null.
 * Child grants inherit the profile through the authority chain and are NOT counted.
 *
 * This must only be called with the actual persisted grants list.
 * Do NOT infer "there is only one profile, so it must be this one."
 */
export function countMandatesBoundToProfile(
  grants: Array<{ paymentProfileId?: string; parentGrantId?: string }>,
  paymentProfileId: string
): number {
  return grants.filter(
    (g) =>
      !g.parentGrantId &&
      g.paymentProfileId === paymentProfileId
  ).length;
}
