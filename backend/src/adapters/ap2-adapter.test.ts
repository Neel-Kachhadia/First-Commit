import { describe, it, expect, beforeEach } from "vitest";
import { ap2Adapter, type Ap2MandateInput } from "./ap2-adapter.js";
import { grantService } from "../services/grant-service.js";
import { authorityEngine } from "../engine/authority-engine.js";
import { grantRepository } from "../store/grant-repository.js";
import { intentRepository } from "../store/intent-repository.js";
import { randomUUID } from "crypto";
import { dynamo } from "../store/dynamodb.js";
import { TABLE_NAME } from "../store/table.js";
import { DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { intentService } from "../services/intent-service.js";

describe("AP2 Adapter", () => {
  const getValidMandate = (): Ap2MandateInput => ({
    mandate_id: `ap2_${randomUUID()}`,
    agent_id: "shopping-agent",
    principal_id: "u123",
    limits: {
      total_budget: 4000,
      transaction_maximum: 1500,
      currency: "INR",
    },
    rules: {
      allowed_merchants: ["Blinkit", "Zepto"],
      allowed_categories: ["GROCERY"],
    },
    validity: {
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  });

  describe("Unit Tests: normalizeMandate", () => {
    it("should translate a valid AP2 mandate into CreateGrantInput", () => {
      const mandate = getValidMandate();
      const input = ap2Adapter.normalizeMandate(mandate, "My AP2 Mandate");

      expect(input.userId).toBe(mandate.principal_id);
      expect(input.label).toBe("My AP2 Mandate");
      expect(input.limit).toBe(4000);
      expect(input.hardMax).toBe(1500);
      expect(input.currency).toBe("INR");
      expect(input.category).toBe("GROCERY");
      expect(input.merchantAllow).toEqual(["Blinkit", "Zepto"]);
      expect(input.expiresAt).toBe(mandate.validity.end_time);
      expect(input.evidence?.sourceProtocol).toBe("AP2");
      expect(input.evidence?.mandateRef).toBe(mandate.mandate_id);
      expect(input.delegationEnabled).toBe(true);
    });

    it("should reject multiple categories", () => {
      const mandate = getValidMandate();
      mandate.rules.allowed_categories = ["GROCERY", "ELECTRONICS"];

      expect(() =>
        ap2Adapter.normalizeMandate(mandate, "My AP2 Mandate")
      ).toThrowError(/maximum of 1 category restriction/);
    });

    it("should reject future start times", () => {
      const mandate = getValidMandate();
      const future = new Date();
      future.setHours(future.getHours() + 2);
      mandate.validity.start_time = future.toISOString();

      expect(() =>
        ap2Adapter.normalizeMandate(mandate, "My AP2 Mandate")
      ).toThrowError(/activate.*immediately/i);
    });

    it("should fall back gracefully when optional fields are missing", () => {
      const mandate = getValidMandate();
      delete mandate.limits.transaction_maximum;
      delete mandate.rules.allowed_categories;
      delete mandate.rules.allowed_merchants;

      const input = ap2Adapter.normalizeMandate(mandate, "Fallback Mandate");

      expect(input.hardMax).toBe(4000); // defaults to total_budget
      expect(input.category).toBeUndefined();
      expect(input.merchantAllow).toEqual([]);
    });
  });

  describe("Integration Test: AP2 -> Grant -> Authority Engine", () => {
    it("should successfully execute end-to-end authorization from an AP2 mandate", async () => {
      // 1. Receive AP2 Mandate
      const mandate = getValidMandate();
      const input = ap2Adapter.normalizeMandate(mandate, "Integration AP2 Mandate");

      // 2. Create Grant
      const grant = await grantService.createGrant(input);

      expect(grant.grantId).toBeDefined();
      expect(grant.status).toBe("ACTIVE");

      // 3. Authority Engine Evaluation - ALLOW
      const allowedResult = await intentService.createIntent({
        intentId: `i_${randomUUID()}`,
        userId: "u123",
        grantId: grant.grantId,
        amount: 1000,
        currency: "INR",
        merchant: {
          merchantId: "Blinkit",
          name: "Blinkit App",
          category: "GROCERY",
        },
        description: "Valid grocery order",
        idempotencyKey: `idem_${randomUUID()}`,
      });

      expect(allowedResult.decision.decision).toBe("ALLOW");

      // 4. Authority Engine Evaluation - DENY (Violates rules set by AP2)
      const deniedResult = await intentService.createIntent({
        intentId: `i_${randomUUID()}`,
        userId: "u123",
        grantId: grant.grantId,
        amount: 500,
        currency: "INR",
        merchant: {
          merchantId: "Amazon", // Not in allowed_merchants
          name: "Amazon",
          category: "GROCERY", // Matching category so it fails on merchant rule
        },
        description: "Invalid merchant order",
        idempotencyKey: `idem_${randomUUID()}`,
      });

      expect(deniedResult.decision.decision).toBe("DENY");
      expect(deniedResult.decision.reasonCode).toBe("MERCHANT_NOT_ALLOWED");

      // 5. Check remaining budget
      const finalGrant = await grantRepository.getGrant("u123", grant.grantId);
      expect(finalGrant?.consumed).toBe(1000);
      
      const residual = finalGrant!.limit - finalGrant!.consumed;
      expect(residual).toBe(3000);
    });
  });
});
