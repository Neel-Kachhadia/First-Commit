import { describe, expect, it } from "vitest";

import {
  calculateEffectiveCapacity,
} from "./effective-capacity.js";

import type { Grant } from "../store/grant-repository.js";

function grant(
  overrides: Partial<Grant>
): Grant {
  return {
    grantId: "g_test",
    userId: "u123",
    label: "Test",

    currency: "INR",
    limit: 4000,
    consumed: 0,

    window: "WEEKLY",
    windowStart:
      "2026-09-14T00:00:00.000Z",

    delegationEnabled: true,
    maxDepth: 2,
    maxChildren: 5,

    status: "ACTIVE",

    createdAt:
      "2026-09-17T00:00:00.000Z",

    updatedAt:
      "2026-09-17T00:00:00.000Z",

    ...overrides,
  };
}

describe(
  "calculateEffectiveCapacity",
  () => {
    it(
      "uses the minimum residual across the authority path",
      () => {
        const result =
          calculateEffectiveCapacity([
            grant({
              grantId: "g_shop",
              limit: 4000,
              consumed: 1000,
            }),

            grant({
              grantId: "g_grocery",
              limit: 2000,
              consumed: 1249,
            }),
          ]);

        expect(
          result.effectiveCapacity
        ).toBe(751);
      }
    );

    it(
      "returns zero when an ancestor is revoked",
      () => {
        const result =
          calculateEffectiveCapacity([
            grant({
              grantId: "g_shop",
              status: "REVOKED",
            }),

            grant({
              grantId: "g_grocery",
              limit: 2000,
              consumed: 0,
            }),
          ]);

        expect(
          result.effectiveCapacity
        ).toBe(0);

        expect(
          result.blockedBy?.reason
        ).toBe("REVOKED");
      }
    );

    it(
      "returns zero when a grant is expired",
      () => {
        const result =
          calculateEffectiveCapacity([
            grant({
              grantId: "g_expired",
              expiresAt:
                "2020-01-01T00:00:00.000Z",
            }),
          ]);

        expect(
          result.effectiveCapacity
        ).toBe(0);

        expect(
          result.blockedBy?.reason
        ).toBe("EXPIRED");
      }
    );

    it(
      "cannot exceed the parent's residual",
      () => {
        const result =
          calculateEffectiveCapacity([
            grant({
              grantId: "g_parent",
              limit: 1000,
              consumed: 900,
            }),

            grant({
              grantId: "g_child",
              limit: 5000,
              consumed: 0,
            }),
          ]);

        expect(
          result.effectiveCapacity
        ).toBe(100);
      }
    );
  }
);
