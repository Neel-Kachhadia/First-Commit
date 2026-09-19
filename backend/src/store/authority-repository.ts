import {
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

import { dynamo } from "./dynamodb.js";
import { TABLE_NAME } from "./table.js";
import type { Grant, GrantEdge } from "./grant-repository.js";

export interface AuthorityPath {
  grants: Grant[];
  effectiveCapacity: number;
}

export class AuthorityRepository {
  /**
   * Get all children directly delegated by a grant.
   */
  async getChildren(parentGrantId: string): Promise<GrantEdge[]> {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,

        KeyConditionExpression:
          "PK = :pk AND begins_with(SK, :prefix)",

        ExpressionAttributeValues: {
          ":pk": `GRANT#${parentGrantId}`,
          ":prefix": "CHILD#",
        },
      })
    );

    return (result.Items ?? []) as GrantEdge[];
  }

  /**
   * Find a grant by its owner and grant ID.
   */
  async getGrant(
    userId: string,
    grantId: string
  ): Promise<Grant | null> {
    const result = await dynamo.send(
      new GetCommand({
        TableName: TABLE_NAME,

        Key: {
          PK: `USER#${userId}`,
          SK: `GRANT#${grantId}`,
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return result.Item as Grant;
  }

  /**
   * Calculate residual budget for a grant.
   *
   * residual = limit - consumed
   */
  getResidual(grant: Grant): number {
    return Math.max(
      0,
      grant.limit - grant.consumed
    );
  }

  /**
   * Check whether a grant is currently executable.
   */
  isExecutable(grant: Grant): boolean {
    if (grant.status !== "ACTIVE") {
      return false;
    }

    if (grant.expiresAt) {
      const expiresAt =
        new Date(grant.expiresAt).getTime();

      if (Date.now() >= expiresAt) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate effective capacity for a path.
   *
   * effective(node) =
   * min(residual(node), effective(parent))
   */
  calculateEffectiveCapacity(
    grants: Grant[]
  ): number {
    if (grants.length === 0) {
      return 0;
    }

    let effective = Number.POSITIVE_INFINITY;

    for (const grant of grants) {
      if (!this.isExecutable(grant)) {
        return 0;
      }

      const residual = this.getResidual(grant);

      effective = Math.min(
        effective,
        residual
      );
    }

    return Number.isFinite(effective)
      ? effective
      : 0;
  }

  /**
   * Build an authority path from a list of grants.
   *
   * The caller supplies grants in:
   *
   * root → child → grandchild
   */
  buildAuthorityPath(
    grants: Grant[]
  ): AuthorityPath {
    return {
      grants,
      effectiveCapacity:
        this.calculateEffectiveCapacity(grants),
    };
  }
}

export const authorityRepository =
  new AuthorityRepository();
