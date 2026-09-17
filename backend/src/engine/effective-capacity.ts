import type { Grant } from "../store/grant-repository.js";

export interface EffectiveCapacityResult {
  effectiveCapacity: number;
  residualByGrant: Record<string, number>;
  blockedBy?: {
    grantId: string;
    reason: "REVOKED" | "EXPIRED" | "ZERO_RESIDUAL";
  };
}

/**
 * Calculate the effective authority available through
 * an authority path.
 *
 * Invariant:
 *
 * effective(node) =
 * min(residual(node), effective(parent))
 *
 * Therefore a child can never have more effective
 * authority than any ancestor.
 *
 * Expected order:
 *
 * root → child → grandchild
 */
export function calculateEffectiveCapacity(
  grants: Grant[]
): EffectiveCapacityResult {
  if (grants.length === 0) {
    return {
      effectiveCapacity: 0,
      residualByGrant: {},
    };
  }

  let effectiveCapacity = Number.POSITIVE_INFINITY;

  const residualByGrant: Record<string, number> = {};

  for (const grant of grants) {
    const residual = Math.max(
      0,
      grant.limit - grant.consumed
    );

    residualByGrant[grant.grantId] = residual;

    /**
     * Revocation closure:
     * a revoked ancestor makes the entire path
     * non-executable.
     */
    if (grant.status === "REVOKED") {
      return {
        effectiveCapacity: 0,
        residualByGrant,
        blockedBy: {
          grantId: grant.grantId,
          reason: "REVOKED",
        },
      };
    }

    /**
     * Expiration closure.
     */
    if (
      grant.expiresAt &&
      Date.now() >=
        new Date(grant.expiresAt).getTime()
    ) {
      return {
        effectiveCapacity: 0,
        residualByGrant,
        blockedBy: {
          grantId: grant.grantId,
          reason: "EXPIRED",
        },
      };
    }

    /**
     * Zero residual means no authority remains
     * on this path.
     */
    if (residual === 0) {
      return {
        effectiveCapacity: 0,
        residualByGrant,
        blockedBy: {
          grantId: grant.grantId,
          reason: "ZERO_RESIDUAL",
        },
      };
    }

    effectiveCapacity = Math.min(
      effectiveCapacity,
      residual
    );
  }

  return {
    effectiveCapacity: Number.isFinite(
      effectiveCapacity
    )
      ? effectiveCapacity
      : 0,

    residualByGrant,
  };
}
