import { randomUUID } from "crypto";

import {
  IntentSchema,
  type Intent,
} from "../models/intent.js";

import {
  type Decision,
} from "../models/decision.js";

import {
  decisionRepository,
} from "../store/decision-repository.js";

import {
  authorityEngine,
} from "../engine/authority-engine.js";

import {
  resolveAuthorityPath,
} from "../engine/authority-path.js";

import {
  intentRepository,
} from "../store/intent-repository.js";

import {
  reservationRepository,
} from "../store/reservation-repository.js";

export interface CreateIntentInput {
  intentId?: string;

  userId: string;

  grantId: string;

  amount: number;

  currency?: string;

  merchant: {
    merchantId: string;
    name: string;
    category: string;
  };

  description?: string;

  idempotencyKey: string;

  evidence?: {
    sourceProtocol?: string;
    mandateRef?: string;
    signedBy?: string;
  };

  expiresAt?: string;
}

export interface CreateIntentResult {
  intent: Intent;

  decision: Decision;

  replayed: boolean;
}

export class IntentService {
  async createIntent(
    input: CreateIntentInput
  ): Promise<CreateIntentResult> {
    /*
     * 1. Check whether this idempotency key has
     *    already been used.
     */
    const existingIntent =
      await intentRepository.getByIdempotencyKey(
        input.idempotencyKey
      );

    if (existingIntent) {
      /*
       * Re-evaluate is intentionally NOT performed.
       *
       * A replay should return the original intent state
       * rather than creating a second authorization attempt.
       */
      const existingDecision =
        await this.getStoredDecision(
          existingIntent
        );

      return {
        intent: existingIntent,
        decision: existingDecision,
        replayed: true,
      };
    }

    /*
     * 2. Create the canonical intent object.
     */
    const now = new Date().toISOString();

    const intent: Intent =
      IntentSchema.parse({
        intentId:
          input.intentId ??
          `i_${randomUUID()}`,

        userId: input.userId,

        grantId: input.grantId,

        amount: input.amount,

        currency:
          input.currency ?? "INR",

        merchant: input.merchant,

        description: input.description,

        idempotencyKey:
          input.idempotencyKey,

        evidence: input.evidence,

        status: "PENDING",

        createdAt: now,

        expiresAt: input.expiresAt,
      });

    /*
     * 3. Register the idempotency key.
     *
     * This is conditional in DynamoDB.
     *
     * If another request wins the race, DynamoDB
     * throws ConditionalCheckFailedException.
     */
    try {
      await intentRepository.registerIdempotencyKey(
        intent
      );
    } catch (error) {
      /*
       * Another concurrent request may have registered
       * the same key between our read and this write.
       *
       * Retrieve the winning intent and treat this
       * request as a replay.
       */
      const concurrentIntent =
        await intentRepository.getByIdempotencyKey(
          input.idempotencyKey
        );

      if (concurrentIntent) {
        const decision =
          await this.getStoredDecision(
            concurrentIntent
          );

        return {
          intent: concurrentIntent,
          decision,
          replayed: true,
        };
      }

      throw error;
    }

    /*
     * 4. Persist the intent.
     */
    await intentRepository.createIntent(
      intent
    );

    /*
     * 5. Resolve the authority path directly from
     *    DynamoDB.
     *
     *    The caller only supplied the target grant.
     *    The backend determines:
     *
     *    root → child → target
     */
    const authorityPath =
      await resolveAuthorityPath(
        intent.userId,
        intent.grantId
      );

    /*
     * 6. Evaluate financial authority.
     */
    const decision =
      await authorityEngine.evaluate(
        intent,
        authorityPath.grants
      );

    /*
     * Only ALLOW decisions are eligible for reservation.
     *
     * STEP_UP and DENY must never consume authority.
     */
    if (decision.decision === "ALLOW") {
      try {
        await reservationRepository.reserve({
          intentId: intent.intentId,
          userId: intent.userId,
          amount: intent.amount,
          grants: authorityPath.grants,
        });

        /*
         * Reservation succeeded.
         *
         * The decision now represents an executable
         * authorization backed by reserved capacity.
         */
        decision.reserved = true;

        await decisionRepository.createDecision(
          decision
        );

        await intentRepository.updateStatus(
          intent.intentId,
          "RESERVED"
        );

        intent.status = "RESERVED";
      } catch (error) {
        /*
         * The Authority Engine may have observed sufficient
         * capacity, but a concurrent request could have
         * consumed it before this transaction.
         *
         * DynamoDB is the final concurrency authority.
         */
        decision.decision = "DENY";
        decision.reasonCode = "RESERVATION_FAILED";
        decision.reason = "Authorization passed, but atomic reservation failed because the required authority could not be reserved.";
        decision.reserved = false;

        await decisionRepository.createDecision(
          decision
        );

        await intentRepository.updateStatus(
          intent.intentId,
          "DENIED"
        );

        intent.status = "DENIED";
      }
    } else if (decision.decision === "STEP_UP") {
      await decisionRepository.createDecision(
        decision
      );

      await intentRepository.updateStatus(
        intent.intentId,
        "STEP_UP_REQUIRED"
      );

      intent.status = "STEP_UP_REQUIRED";
    } else {
      await decisionRepository.createDecision(
        decision
      );

      await intentRepository.updateStatus(
        intent.intentId,
        "DENIED"
      );

      intent.status = "DENIED";
    }

    return {
      intent,
      decision,
      replayed: false,
    };
  }

  async approveIntent(
    intentId: string
  ): Promise<CreateIntentResult> {
    // 1. Load the existing intent
    const intent = await intentRepository.getIntent(intentId);

    if (!intent) {
      throw new Error(`Intent ${intentId} was not found.`);
    }

    // 2. Approval is only valid for STEP_UP_REQUIRED intents
    if (intent.status !== "STEP_UP_REQUIRED") {
      throw new Error(
        `Intent ${intentId} cannot be approved because its current status is ${intent.status}.`
      );
    }

    // 3. Re-resolve the authority path from current DynamoDB state
    const authorityPath = await resolveAuthorityPath(
      intent.userId,
      intent.grantId
    );

    // 4. Re-evaluate authority at approval time
    //    This is critical: approval must NOT bypass current
    //    revocation, expiration, scope, or capacity rules.
    const decision = await authorityEngine.evaluate(
      intent,
      authorityPath.grants
    );

    // 5. Approval only proceeds if the current state still allows it.
    if (decision.decision !== "ALLOW") {
      await decisionRepository.createDecision(decision);

      await intentRepository.updateStatus(
        intent.intentId,
        decision.decision === "STEP_UP"
          ? "STEP_UP_REQUIRED"
          : "DENIED"
      );

      intent.status =
        decision.decision === "STEP_UP"
          ? "STEP_UP_REQUIRED"
          : "DENIED";

      return {
        intent,
        decision,
        replayed: false,
      };
    }

    // 6. Atomically reserve the authority
    try {
      await reservationRepository.reserve({
        intentId: intent.intentId,
        userId: intent.userId,
        amount: intent.amount,
        grants: authorityPath.grants,
      });

      // 7. Reservation succeeded
      decision.reserved = true;

      await decisionRepository.createDecision(decision);

      await intentRepository.updateStatus(
        intent.intentId,
        "RESERVED"
      );

      intent.status = "RESERVED";

      return {
        intent,
        decision,
        replayed: false,
      };
    } catch (error) {
      // 8. DynamoDB remains the final concurrency authority
      decision.decision = "DENY";
      decision.reasonCode = "RESERVATION_FAILED";
      decision.reason =
        "Approval succeeded at the policy layer, but atomic reservation failed because the required authority could not be reserved.";
      decision.reserved = false;

      await decisionRepository.createDecision(decision);

      await intentRepository.updateStatus(
        intent.intentId,
        "DENIED"
      );

      intent.status = "DENIED";

      return {
        intent,
        decision,
        replayed: false,
      };
    }
  }

  /**
   * Retrieve stored decision for replay.
   */
  private async getStoredDecision(
    intent: Intent
  ): Promise<Decision> {
    const decision = await decisionRepository.getLatestDecision(intent.intentId);

    if (!decision) {
      throw new Error(`No decision found for existing intent ${intent.intentId}`);
    }

    return decision;
  }
}

export const intentService =
  new IntentService();
