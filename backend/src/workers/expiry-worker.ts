import { grantRepository } from "../store/grant-repository.js";
import { auditRepository } from "../store/audit-repository.js";
import { metrics } from "../utils/metrics.js";

/**
 * Sweeps for ACTIVE grants that have reached their expiration time
 * and marks them as EXPIRED. This maintains database cleanliness.
 * NOTE: The primary security boundary is synchronous expiry checking
 * during authorization; this worker only converges the persisted state.
 */
export async function runExpirySweep(): Promise<void> {
  console.log("[ExpiryWorker] Starting expiry sweep...");
  try {
    const expiredGrants = await grantRepository.findExpiredActiveGrants();
    
    if (expiredGrants.length === 0) {
      console.log("[ExpiryWorker] No expired grants found.");
      return;
    }

    console.log(`[ExpiryWorker] Found ${expiredGrants.length} expired grants. Updating...`);
    
    let count = 0;
    for (const grant of expiredGrants) {
      try {
        await grantRepository.markGrantExpired(grant.userId, grant.grantId);
        await auditRepository.logEvent(
          grant.userId,
          "GRANT_EXPIRED",
          { grantId: grant.grantId },
          "SYSTEM"
        );
        metrics.logEvent("GRANT_EXPIRED", { grantId: grant.grantId });
        count++;
      } catch (err: any) {
        if (err.name === "ConditionalCheckFailedException") {
          // The grant was already updated (e.g. revoked or expired by another worker)
          // between the Scan and this Update. We can safely ignore this.
          console.log(`[ExpiryWorker] Grant ${grant.grantId} already modified. Skipping.`);
        } else {
          console.error(`[ExpiryWorker] Failed to expire grant ${grant.grantId}:`, err);
        }
      }
    }

    console.log(`[ExpiryWorker] Sweep complete. Expired ${count}/${expiredGrants.length} grants.`);
  } catch (err: any) {
    console.error("[ExpiryWorker] Critical error during sweep:", err);
  }
}
