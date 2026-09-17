import {
  authorityRepository,
} from "../store/authority-repository.js";

import type { Grant } from "../store/grant-repository.js";

export interface AuthorityPathResult {
  grants: Grant[];
  grantIds: string[];
}

export async function resolveAuthorityPath(
  userId: string,
  targetGrantId: string
): Promise<AuthorityPathResult> {
  const grants: Grant[] = [];
  const visited = new Set<string>();

  let currentGrantId:
    | string
    | undefined = targetGrantId;

  while (currentGrantId) {
    /*
     * Protect against malformed/circular authority graphs.
     */
    if (visited.has(currentGrantId)) {
      throw new Error(
        `Circular authority path detected at grant ${currentGrantId}.`
      );
    }

    visited.add(currentGrantId);

    /*
     * Every grant must belong to the requesting user.
     */
    const grant =
      await authorityRepository.getGrant(
        userId,
        currentGrantId
      );

    if (!grant) {
      throw new Error(
        `Grant ${currentGrantId} was not found for user ${userId}.`
      );
    }

    grants.push(grant);

    currentGrantId =
      grant.parentGrantId;
  }

  /*
   * Traversal happens child → root.
   *
   * Authority evaluation needs root → child.
   */
  grants.reverse();

  return {
    grants,

    grantIds: grants.map(
      (grant) => grant.grantId
    ),
  };
}
