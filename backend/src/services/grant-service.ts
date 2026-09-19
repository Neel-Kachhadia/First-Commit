import { randomUUID } from "crypto";

import {
  ContractSchema,
  type Contract,
} from "../models/contract.js";

import {
  grantRepository,
  type Grant,
  type GrantEdge,
} from "../store/grant-repository.js";

import {
  auditRepository,
} from "../store/audit-repository.js";

export interface CreateGrantInput {
  userId: string;

  label: string;

  parentGrantId?: string;

  currency?: string;

  limit: number;

  window:
    | "TRANSACTION"
    | "DAILY"
    | "WEEKLY"
    | "MONTHLY";

  windowStart: string;

  hardMax: number;

  stepUpAbove?: number;

  category?: string;

  merchantAllow?: string[];

  merchantDeny?: string[];

  delegationEnabled?: boolean;

  maxDepth?: number;

  maxChildren?: number;

  expiresAt?: string;

  evidence?: {
    sourceProtocol?: string;
    mandateRef?: string;
    signedBy?: string;
  };
}

export class GrantService {
  async createGrant(
    input: CreateGrantInput
  ): Promise<Grant> {
    /*
     * 1. Validate the parent if this is a delegated grant.
     */
    let parentGrant: Grant | null = null;

    if (input.parentGrantId) {
      parentGrant =
        await this.findGrantById(
          input.userId,
          input.parentGrantId
        );

      if (!parentGrant) {
        throw new Error(
          `Parent grant ${input.parentGrantId} was not found.`
        );
      }

      if (
        parentGrant.status !== "ACTIVE"
      ) {
        throw new Error(
          "Cannot delegate from an inactive grant."
        );
      }

      if (
        !parentGrant.delegationEnabled
      ) {
        throw new Error(
          "Delegation is not enabled on the parent grant."
        );
      }

      /*
       * ── maxDepth enforcement ────────────────────────────────────────────────
       *
       * Walk the ancestry chain from the parent to the root and compute
       * the current depth of the parent node.  The new child will sit at
       * depth + 1.  The root grant's maxDepth is the system-wide ceiling.
       *
       * Depth is 0-indexed: a root grant is at depth 0, its direct children
       * are at depth 1, and so on.
       */
      const rootGrant = await this.findRootGrant(input.userId, parentGrant);
      const maxDepth = rootGrant.maxDepth ?? 0;

      if (maxDepth > 0) {
        const parentDepth = await this.computeDepth(input.userId, parentGrant);
        const childDepth = parentDepth + 1;

        if (childDepth > maxDepth) {
          throw Object.assign(
            new Error(
              `Delegation depth limit exceeded: attempted depth ${childDepth}, maximum is ${maxDepth}.`
            ),
            { code: "MAX_DELEGATION_DEPTH_EXCEEDED" }
          );
        }
      }

      /*
       * ── maxChildren enforcement ─────────────────────────────────────────────
       *
       * Count existing children of the parent grant.
       * maxChildren = 0 means unlimited.
       */
      const parentMaxChildren = parentGrant.maxChildren ?? 0;

      if (parentMaxChildren > 0) {
        const existingEdges = await grantRepository.listChildren(
          parentGrant.grantId
        );

        // Only count edges whose child grants are ACTIVE
        const activeChildCount = await this.countActiveChildren(
          input.userId,
          existingEdges.map((e) => e.childGrantId)
        );

        if (activeChildCount >= parentMaxChildren) {
          throw Object.assign(
            new Error(
              `Delegation children limit exceeded: parent grant ${parentGrant.grantId} already has ${activeChildCount} active children (max: ${parentMaxChildren}).`
            ),
            { code: "MAX_DELEGATION_CHILDREN_EXCEEDED" }
          );
        }
      }
    }


    /*
     * 2. Generate the grant ID.
     */
    const grantId =
      `g_${randomUUID()}`;

    const now =
      new Date().toISOString();

    /*
     * 3. Build the grant.
     */
    const grant: Grant = {
      grantId,

      userId: input.userId,

      label: input.label,

      parentGrantId:
        input.parentGrantId,

      currency:
        input.currency ?? "INR",

      limit: input.limit,

      consumed: 0,

      window: input.window,

      windowStart:
        input.windowStart,

      hardMax: input.hardMax,

      stepUpAbove:
        input.stepUpAbove,

      category:
        input.category,

      merchantAllow:
        input.merchantAllow ?? [],

      merchantDeny:
        input.merchantDeny ?? [],

      delegationEnabled:
        input.delegationEnabled ?? false,

      maxDepth:
        input.maxDepth ?? 0,

      maxChildren:
        input.maxChildren ?? 0,

      expiresAt:
        input.expiresAt,

      status: "ACTIVE",

      createdAt: now,

      updatedAt: now,

      evidence: input.evidence,
    };

    /*
     * 4. Validate basic financial constraints.
     */
    if (
      grant.hardMax !== undefined &&
      grant.hardMax > grant.limit
    ) {
      throw new Error(
        "Per-transaction hard maximum cannot exceed the grant limit."
      );
    }

    if (
      grant.stepUpAbove !== undefined &&
      grant.stepUpAbove > grant.hardMax!
    ) {
      throw new Error(
        "Step-up threshold cannot exceed the per-transaction hard maximum."
      );
    }

    /*
     * 5. Validate delegation amount.
     *
     * A child cannot receive more authority than
     * the parent's currently available residual.
     */
    if (parentGrant) {
      const parentResidual =
        Math.max(
          0,
          parentGrant.limit -
            parentGrant.consumed
        );

      if (
        grant.limit >
        parentResidual
      ) {
        throw new Error(
          `Child grant limit ₹${grant.limit} exceeds parent residual authority of ₹${parentResidual}.`
        );
      }

      /*
       * A child cannot exceed the parent's
       * transaction hard maximum.
       */
      if (
        parentGrant.hardMax !== undefined &&
        grant.hardMax !== undefined &&
        grant.hardMax >
          parentGrant.hardMax
      ) {
        throw new Error(
          "Child per-transaction limit cannot exceed parent per-transaction limit."
        );
      }
    }

    /*
     * 6. Validate the contract-shaped data.
     *
     * This keeps grant creation aligned with the
     * Financial Intent Contract model.
     */
    const contract: Contract =
      ContractSchema.parse({
        contractId:
          `contract_${grantId}`,

        principal:
          input.userId,

        holder:
          input.userId,

        parentGrantId:
          input.parentGrantId,

        label:
          grant.label,

        budget: {
          currency:
            grant.currency,

          limit:
            grant.limit,

          window:
            grant.window,

          windowStart:
            grant.windowStart,

          consumed:
            grant.consumed,
        },

        perTransaction: {
          hardMax:
            grant.hardMax!,

          stepUpAbove:
            grant.stepUpAbove,
        },

        scope: {
          category:
            grant.category,

          merchantAllow:
            grant.merchantAllow ?? [],

          merchantDeny:
            grant.merchantDeny ?? [],
        },

        delegation: {
          enabled:
            grant.delegationEnabled,

          maxDepth:
            grant.maxDepth,

          maxChildren:
            grant.maxChildren,
        },

        expiresAt:
          grant.expiresAt,

        status: "ACTIVE",

        evidence:
          input.evidence ?? {},

        createdAt:
          now,

        updatedAt:
          now,
      });

    /*
     * The contract has now passed validation.
     * The grant becomes the executable representation
     * in the authority graph.
     */
    void contract;

    /*
     * 7. Persist the grant.
     */
    await grantRepository.createGrant(
      grant
    );

    /*
     * 8. Create the parent → child edge.
     */
    if (parentGrant) {
      const edge: GrantEdge = {
        parentGrantId:
          parentGrant.grantId,

        childGrantId:
          grant.grantId,

        createdAt: now,
      };

      await grantRepository.createEdge(
        edge
      );
    }

    await auditRepository.logEvent(
      input.userId,
      "GRANT_CREATED",
      { grantId, parentGrantId: input.parentGrantId },
      input.userId
    );

    return grant;
  }

  async revokeGrant(
    userId: string,
    grantId: string
  ): Promise<Grant> {
    const grant = await grantRepository.getGrant(
      userId,
      grantId
    );

    if (!grant) {
      throw new Error(
        `Grant ${grantId} was not found.`
      );
    }

    if (grant.status === "REVOKED") {
      throw new Error(
        `Grant ${grantId} is already revoked.`
      );
    }

    await grantRepository.revokeGrant(
      userId,
      grantId
    );

    await auditRepository.logEvent(
      userId,
      "GRANT_REVOKED",
      { grantId },
      userId
    );

    const revokedGrant =
      await grantRepository.getGrant(
        userId,
        grantId
      );

    if (!revokedGrant) {
      throw new Error(
        `Grant ${grantId} could not be loaded after revocation.`
      );
    }

    return revokedGrant;
  }

  async listUserGrants(userId: string): Promise<Grant[]> {
    return grantRepository.listUserGrants(userId);
  }

  private async findGrantById(
    userId: string,
    grantId: string
  ): Promise<Grant | null> {
    return grantRepository.getGrant(
      userId,
      grantId
    );
  }

  /**
   * Walk ancestry chain from a given grant to the root.
   * Protects against cycles (max 20 hops).
   */
  private async findRootGrant(
    userId: string,
    grant: Grant
  ): Promise<Grant> {
    let current = grant;
    let hops = 0;
    const MAX_HOPS = 20;

    while (current.parentGrantId && hops < MAX_HOPS) {
      const parent = await this.findGrantById(userId, current.parentGrantId);
      if (!parent) break;
      current = parent;
      hops++;
    }

    return current;
  }

  /**
   * Compute how many delegation hops from a grant to the root.
   * Root = depth 0, first child = depth 1, etc.
   */
  private async computeDepth(
    userId: string,
    grant: Grant
  ): Promise<number> {
    let depth = 0;
    let current = grant;
    const MAX_DEPTH = 20;

    while (current.parentGrantId && depth < MAX_DEPTH) {
      const parent = await this.findGrantById(userId, current.parentGrantId);
      if (!parent) break;
      current = parent;
      depth++;
    }

    return depth;
  }

  /**
   * Given a list of child grantIds, resolve them and count
   * how many are still ACTIVE (revoked/expired do not count).
   */
  private async countActiveChildren(
    userId: string,
    childGrantIds: string[]
  ): Promise<number> {
    let count = 0;
    for (const grantId of childGrantIds) {
      const g = await this.findGrantById(userId, grantId);
      if (g && g.status === "ACTIVE") {
        count++;
      }
    }
    return count;
  }
}

export const grantService =
  new GrantService();
