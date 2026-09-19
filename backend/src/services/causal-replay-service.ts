import { decisionRepository } from "../store/decision-repository.js";
import { grantRepository, type Grant } from "../store/grant-repository.js";
import { intentRepository } from "../store/intent-repository.js";
import { reservationRepository } from "../store/reservation-repository.js";
import { paymentService } from "../payments/payment-service.js";
import type { Intent } from "../models/intent.js";
import type { Decision } from "../models/decision.js";

export type CausalReplayNodeType =
  | "PROVIDER_RESULT"
  | "PROVIDER_WEBHOOK"
  | "EXECUTION"
  | "DECISION"
  | "DECISION_CAUSE"
  | "AUTHORITY_STATE"
  | "AGENT"
  | "DELEGATION"
  | "MANDATE"
  | "HUMAN_INTENT";

export type CausalReplayEdgeType =
  | "CAUSED_BY"
  | "GOVERNED_BY"
  | "DELEGATED_FROM"
  | "INITIATED_BY"
  | "AUTHORIZED_BY"
  | "BLOCKED_BY"
  | "RESERVED_AGAINST"
  | "EXECUTED_BY"
  | "CONFIRMED_BY"
  | "ORIGINATED_FROM";

export interface CausalReplayNode {
  id: string;
  type: CausalReplayNodeType;
  label: string;
  status?: string;
  data?: Record<string, unknown>;
}

export interface CausalReplayEdge {
  from: string;
  to: string;
  type: CausalReplayEdgeType;
}

export interface CausalReplay {
  replayId: string;
  intentId: string;
  decisionId: string;
  userId: string;

  outcome: {
    decision: string;
    intentStatus: string;
    providerStatus: string;
    providerInvoked: boolean;
  };

  coverage: {
    completed: number;
    total: number;
    status: "COMPLETE" | "PARTIAL";
  };

  nodes: CausalReplayNode[];
  edges: CausalReplayEdge[];

  chain: {
    providerWebhook?: string;
    providerResult?: string;
    execution?: string;
    decision: string;
    decisionCause?: string;
    authorityState?: string;
    agent?: string;
    delegation?: string[];
    mandate?: string;
    humanIntent?: string;
  };

  reconstructedAt: string;
}

export class CausalReplayService {
  async replay(
    intentId: string,
    userId: string
  ): Promise<CausalReplay> {
    /*
     * 1. Load canonical intent.
     *
     * The intent is the root lookup. Every subsequent record
     * must belong to the same user / authority chain.
     */
    const intent = await intentRepository.getIntent(intentId);

    if (!intent) {
      throw new Error(`Intent ${intentId} was not found.`);
    }

    if (intent.userId !== userId) {
      throw new Error("Intent does not belong to the requested user.");
    }

    /*
     * 2. Load the complete decision history.
     *
     * We deliberately use the persisted decision rather than
     * evaluating the intent again.
     */
    const decisions =
      await decisionRepository.getDecisionsForIntent(intentId);

    if (decisions.length === 0) {
      throw new Error(
        `No persisted decision exists for intent ${intentId}.`
      );
    }

    const decision =
      decisions[decisions.length - 1];

    /*
     * 3. Load the persisted decision receipt.
     *
     * The receipt is evidence for the decision and may contain
     * the authority path and state snapshots captured at decision time.
     */
    const receipt =
      await decisionRepository.getReceipt(
        intentId,
        decision.decisionId
      );

    /*
     * 4. Resolve the authority lineage.
     *
     * We walk from the target grant back to the root.
     *
     * This is reconstruction only.
     * It does NOT re-authorize the transaction.
     */
    const grants: Grant[] = [];

    let currentGrantId: string | undefined =
      intent.grantId;

    const visited = new Set<string>();

    while (currentGrantId) {
      if (visited.has(currentGrantId)) {
        throw new Error(
          `Grant lineage cycle detected at ${currentGrantId}.`
        );
      }

      visited.add(currentGrantId);

      const grant =
        await grantRepository.getGrant(
          userId,
          currentGrantId
        );

      if (!grant) {
        break;
      }

      grants.push(grant);
      currentGrantId = grant.parentGrantId;
    }

    /*
     * grants currently contains:
     *
     * target → parent → root
     *
     * Reverse it for human-readable authority flow:
     *
     * root → parent → target
     */
    const authorityLineage =
      [...grants].reverse();

    /*
     * 5. Construct deterministic replay nodes.
     */
    const nodes: CausalReplayNode[] = [];
    const edges: CausalReplayEdge[] = [];

    const decisionNodeId =
      `decision:${decision.decisionId}`;

    const intentNodeId =
      `intent:${intent.intentId}`;

    nodes.push({
      id: decisionNodeId,
      type: "DECISION",
      label: `${decision.decision} · ${decision.amount} ${decision.currency}`,
      status: decision.decision,
      data: {
        decisionId: decision.decisionId,
        reasonCode: decision.reasonCode,
        reason: decision.reason,
        reserved: decision.reserved,
        createdAt: decision.createdAt,
      },
    });

    /*
     * 6. Decision cause.
     *
     * This is intentionally derived from persisted deterministic
     * decision fields. No LLM explanation is generated.
     */
    const causeNodeId =
      `cause:${decision.decisionId}`;

    nodes.push({
      id: causeNodeId,
      type: "DECISION_CAUSE",
      label:
        decision.reasonCode ??
        "DECISION_RECORDED",
      data: {
        reasonCode: decision.reasonCode,
        reason: decision.reason,
        matchedPolicy: decision.matchedPolicy,
        blockedItem: decision.blockedItem,
        blockedCategory: decision.blockedCategory,
      },
    });

    edges.push({
      from: decisionNodeId,
      to: causeNodeId,
      type: "CAUSED_BY",
    });

    /*
     * 7. Authority state.
     *
     * Prefer the state captured in the signed receipt.
     * If it isn't available, expose the currently persisted
     * grant state without pretending it is historical state.
     */
    const authorityStateId =
      `authority:${intent.grantId}`;

    nodes.push({
      id: authorityStateId,
      type: "AUTHORITY_STATE",
      label: "Authority state",
      data: {
        source:
          receipt?.stateBefore
            ? "DECISION_RECEIPT"
            : "CURRENT_GRANT_STATE",

        stateBefore:
          receipt?.stateBefore ?? null,

        stateAfter:
          receipt?.stateAfter ?? null,

        effectiveCapacity:
          decision.effectiveCapacity,

        grantResidual:
          decision.grantResidual,

        reserved:
          decision.reserved,
      },
    });

    edges.push({
      from: causeNodeId,
      to: authorityStateId,
      type: "GOVERNED_BY",
    });

    /*
     * 8. Grant / delegation lineage.
     */
    const delegationNodeIds: string[] = [];

    authorityLineage.forEach(
      (grant, index) => {
        const isRoot =
          !grant.parentGrantId;

        const nodeId = isRoot
          ? `mandate:${grant.grantId}`
          : `delegation:${grant.grantId}`;

        nodes.push({
          id: nodeId,
          type: isRoot
            ? "MANDATE"
            : "DELEGATION",
          label: grant.label,
          status: grant.status,
          data: {
            grantId: grant.grantId,
            parentGrantId:
              grant.parentGrantId ?? null,
            limit: grant.limit,
            consumed: grant.consumed,
            remaining:
              Math.max(
                grant.limit - grant.consumed,
                0
              ),
            currency: grant.currency,
            window: grant.window,
            hardMax: grant.hardMax,
            stepUpAbove:
              grant.stepUpAbove,
            category: grant.category,
            merchantAllow:
              grant.merchantAllow ?? [],
            merchantDeny:
              grant.merchantDeny ?? [],
            blockedCategories:
              grant.blockedCategories ?? [],
            blockedItems:
              grant.blockedItems ?? [],
            status: grant.status,
            expiresAt:
              grant.expiresAt ?? null,
            evidence:
              grant.evidence ?? null,
          },
        });

        if (!isRoot) {
          delegationNodeIds.push(nodeId);

          const parent =
            authorityLineage[index - 1];

          if (parent) {
            edges.push({
              from: nodeId,
              to: `mandate:${parent.grantId}`,
              type: "DELEGATED_FROM",
            });

            /*
             * For deeper chains, the parent may itself be
             * represented as a delegation node.
             */
            const parentNodeId =
              parent.parentGrantId
                ? `delegation:${parent.grantId}`
                : `mandate:${parent.grantId}`;

            edges[edges.length - 1] = {
              from: nodeId,
              to: parentNodeId,
              type: "DELEGATED_FROM",
            };
          }
        }
      }
    );

    /*
     * 9. Connect authority state to the target grant.
     */
    const targetNodeId =
      intent.grantId ===
      authorityLineage[0]?.grantId
        ? `mandate:${intent.grantId}`
        : `delegation:${intent.grantId}`;

    if (
      authorityLineage.some(
        (grant) =>
          grant.grantId === intent.grantId
      )
    ) {
      edges.push({
        from: authorityStateId,
        to: targetNodeId,
        type: "AUTHORIZED_BY",
      });
    }

    /*
     * 10. Human intent.
     *
     * The current Intent model provides the original
     * structured request. If a voiceCommandId exists in
     * evidence, preserve it as the source reference.
     */
    const humanIntentId =
      `human-intent:${intent.intentId}`;

    nodes.push({
      id: humanIntentId,
      type: "HUMAN_INTENT",
      label:
        intent.description ??
        "Original human intent",
      data: {
        intentId: intent.intentId,
        description:
          intent.description ?? null,
        amount: intent.amount,
        currency: intent.currency,
        merchant: intent.merchant,
        evidence:
          intent.evidence ?? null,
      },
    });

    /*
     * Root mandate originates from the structured intent.
     */
    const rootGrant =
      authorityLineage[0];

    if (rootGrant) {
      edges.push({
        from:
          `mandate:${rootGrant.grantId}`,
        to: humanIntentId,
        type: "ORIGINATED_FROM",
      });
    }

    /*
     * 11. Intent → decision.
     */
    nodes.push({
      id: intentNodeId,
      type: "AGENT",
      label:
        `Intent · ${intent.merchant.name}`,
      data: {
        intentId: intent.intentId,
        grantId: intent.grantId,
        amount: intent.amount,
        currency: intent.currency,
        merchant: intent.merchant,
        description:
          intent.description ?? null,
        status: intent.status,
      },
    });

    edges.push({
      from: decisionNodeId,
      to: intentNodeId,
      type: "INITIATED_BY",
    });

    /*
     * 12. Provider / execution evidence.
     *
     * We intentionally derive this from persisted intent fields.
     * If the current backend has richer execution records,
     * those can be connected in the next step without changing
     * this replay contract.
     */
    const paymentRecord = await paymentService.getPaymentRecord(intent.intentId);

    const providerStatus =
      paymentRecord?.status ??
      intent.providerStatus ??
      decision.providerStatus ??
      "NOT_INVOKED";

    const providerInvoked =
      providerStatus !== "NOT_INVOKED";

    let executionNodeId: string | undefined;
    let providerNodeId: string | undefined;
    let webhookNodeId: string | undefined;

    if (providerStatus === "NOT_INVOKED") {
      providerNodeId = `provider-result:${intent.intentId}`;
      nodes.push({
        id: providerNodeId,
        type: "PROVIDER_RESULT",
        label: "Razorpay",
        status: "NOT_INVOKED",
        data: {
          environment: "TEST_MODE",
          reason: "Authorization decision prevented provider execution",
        },
      });

      edges.push({
        from: decisionNodeId,
        to: providerNodeId,
        type: "EXECUTED_BY",
      });
    } else if (paymentRecord) {
      executionNodeId = `execution:${intent.intentId}`;

      nodes.push({
        id: executionNodeId,
        type: "EXECUTION",
        label: "Payment Execution",
        status: paymentRecord.status,
        data: {
          intentId: paymentRecord.intentId,
          amount: paymentRecord.amount,
          currency: paymentRecord.currency,
        },
      });

      edges.push({
        from: executionNodeId,
        to: decisionNodeId,
        type: "CAUSED_BY",
      });

      providerNodeId = `provider:${paymentRecord.intentId}`;

      nodes.push({
        id: providerNodeId,
        type: "PROVIDER_RESULT",
        label: "Razorpay",
        status: paymentRecord.status,
        data: {
          environment: "TEST_MODE",
          razorpayOrderId: paymentRecord.razorpayOrderId,
          razorpayPaymentId: paymentRecord.razorpayPaymentId,
          providerWebhookEventId: paymentRecord.providerWebhookEventId,
        },
      });

      edges.push({
        from: providerNodeId,
        to: executionNodeId,
        type: "CONFIRMED_BY",
      });

      if (paymentRecord.providerWebhookEventId) {
        webhookNodeId = `webhook:${paymentRecord.providerWebhookEventId}`;

        nodes.push({
          id: webhookNodeId,
          type: "PROVIDER_WEBHOOK",
          label: "Razorpay Webhook",
          status: "VERIFIED",
          data: {
            eventId: paymentRecord.providerWebhookEventId,
            orderId: paymentRecord.razorpayOrderId,
            paymentId: paymentRecord.razorpayPaymentId,
          },
        });

        edges.push({
          from: providerNodeId,
          to: webhookNodeId,
          type: "CONFIRMED_BY",
        });
      }
    }

    /*
     * 13. Reservation evidence.
     */
    if (decision.reserved) {
      edges.push({
        from: authorityStateId,
        to: decisionNodeId,
        type: "RESERVED_AGAINST",
      });
    }

    /*
     * 14. Calculate replay completeness.
     *
     * Required chain:
     * decision
     * cause
     * authority
     * mandate
     * human intent
     *
     * Provider/execution are only required when the provider
     * was actually invoked.
     */
    const required = [
      decisionNodeId,
      causeNodeId,
      authorityStateId,
      rootGrant
        ? `mandate:${rootGrant.grantId}`
        : undefined,
      humanIntentId,
      providerInvoked
        ? executionNodeId
        : true,
      providerInvoked
        ? providerNodeId
        : true,
    ];

    const completed =
      required.filter(Boolean).length;

    const total = required.length;

    return {
      replayId:
        `replay:${intent.intentId}:${decision.decisionId}`,

      intentId: intent.intentId,
      decisionId: decision.decisionId,
      userId,

      outcome: {
        decision: decision.decision,
        intentStatus: intent.status,
        providerStatus,
        providerInvoked,
      },

      coverage: {
        completed,
        total,
        status:
          completed === total
            ? "COMPLETE"
            : "PARTIAL",
      },

      nodes,
      edges,

      chain: {
        providerWebhook: webhookNodeId,
        providerResult: providerNodeId,
        execution: executionNodeId,
        decision: decisionNodeId,
        decisionCause: causeNodeId,
        authorityState: authorityStateId,
        agent: intentNodeId,
        delegation: delegationNodeIds,
        mandate: rootGrant
          ? `mandate:${rootGrant.grantId}`
          : undefined,
        humanIntent: humanIntentId,
      },

      reconstructedAt:
        new Date().toISOString(),
    };
  }
}

export const causalReplayService =
  new CausalReplayService();
