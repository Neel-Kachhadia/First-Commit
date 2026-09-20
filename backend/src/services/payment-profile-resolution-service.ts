import { grantRepository, Grant } from "../store/grant-repository.js";
import { paymentProfileRepository } from "../store/payment-profile-repository.js";
import { PaymentProfile } from "../models/payment-profile.js";

export class PaymentProfileResolutionService {
  /**
   * Resolves the Payment Profile for a given grant by walking up the delegation
   * chain to the root mandate and returning its bound payment profile.
   */
  async resolvePaymentProfileForGrant(
    grantId: string,
    userId: string
  ): Promise<PaymentProfile> {
    let currentGrantId = grantId;
    let hops = 0;
    const MAX_HOPS = 20;

    let rootGrant: Grant | null = null;

    while (hops < MAX_HOPS) {
      const grant = await grantRepository.getGrant(userId, currentGrantId);
      if (!grant) {
        throw new Error(`Grant ${currentGrantId} was not found in the authority chain.`);
      }

      if (grant.parentGrantId) {
        currentGrantId = grant.parentGrantId;
        hops++;
      } else {
        rootGrant = grant;
        break;
      }
    }

    if (!rootGrant) {
      throw new Error(`Exceeded maximum delegation depth while resolving root mandate for grant ${grantId}.`);
    }

    if (!rootGrant.paymentProfileId) {
      const error = new Error(`Payment profile is not configured on the root mandate.`);
      (error as any).code = "PAYMENT_PROFILE_NOT_CONFIGURED";
      throw error;
    }

    const profile = await paymentProfileRepository.getProfile(
      userId,
      rootGrant.paymentProfileId
    );

    if (!profile) {
      const error = new Error(`Payment profile ${rootGrant.paymentProfileId} was not found.`);
      (error as any).code = "PAYMENT_PROFILE_NOT_FOUND";
      throw error;
    }

    if (profile.status !== "ACTIVE") {
      const error = new Error(`Payment profile ${rootGrant.paymentProfileId} is disabled.`);
      (error as any).code = "PAYMENT_PROFILE_DISABLED";
      throw error;
    }

    if (profile.provider !== "RAZORPAY" || profile.environment !== "TEST") {
      throw new Error(`Only RAZORPAY TEST payment profiles are supported.`);
    }

    return profile;
  }
}

export const paymentProfileResolutionService = new PaymentProfileResolutionService();
