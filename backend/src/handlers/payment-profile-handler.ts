import { Request, Response } from "express";
import { PaymentProfile } from "../models/payment-profile.js";
import { paymentProfileRepository } from "../store/payment-profile-repository.js";

// Helper to get userId from the authenticated request
function getUserId(req: Request): string {
  return (req as any).user?.sub;
}

export async function createPaymentProfileHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const { provider, environment, methodType, displayName } = req.body;

    if (provider !== "RAZORPAY" || environment !== "TEST" || methodType !== "CARD" || !displayName) {
      res.status(400).json({ success: false, error: "Invalid profile data for simulated test mode." });
      return;
    }

    const paymentProfileId = `pp_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();

    const profile: PaymentProfile = {
      paymentProfileId,
      userId,
      provider,
      environment,
      methodType,
      displayName,
      status: "ACTIVE",
      connectionMode: "SIMULATED",
      createdAt: now,
      updatedAt: now,
    };

    await paymentProfileRepository.createProfile(profile);

    res.status(201).json(profile);
  } catch (error: any) {
    console.error("[createPaymentProfileHandler] Error:", error);
    res.status(500).json({ success: false, error: "Failed to create payment profile" });
  }
}

export async function getPaymentProfilesHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const profiles = await paymentProfileRepository.getProfilesByUser(userId);

    res.status(200).json(profiles);
  } catch (error: any) {
    console.error("[getPaymentProfilesHandler] Error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch payment profiles" });
  }
}

export async function getPaymentProfileHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const id = req.params.id as string;
    if (!id) {
      res.status(400).json({ success: false, error: "Missing profile ID" });
      return;
    }

    const profile = await paymentProfileRepository.getProfile(userId, id);
    if (!profile) {
      res.status(404).json({ success: false, error: "Profile not found" });
      return;
    }

    res.status(200).json(profile);
  } catch (error: any) {
    console.error("[getPaymentProfileHandler] Error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch payment profile" });
  }
}

export async function disablePaymentProfileHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const id = req.params.id as string;
    if (!id) {
      res.status(400).json({ success: false, error: "Missing profile ID" });
      return;
    }

    const now = new Date().toISOString();
    await paymentProfileRepository.disableProfile(userId, id, now);

    res.status(200).json({ success: true, status: "DISABLED" });
  } catch (error: any) {
    console.error("[disablePaymentProfileHandler] Error:", error);
    res.status(500).json({ success: false, error: "Failed to disable payment profile" });
  }
}
