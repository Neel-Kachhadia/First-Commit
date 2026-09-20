export interface PaymentProfile {
  paymentProfileId: string;
  userId: string;

  provider: "RAZORPAY";
  environment: "TEST";

  methodType: "CARD";
  providerCustomerId?: string;
  providerTokenRef?: string;

  displayName: string;
  status: "ACTIVE" | "DISABLED";
  connectionMode: "SIMULATED" | "PROVIDER_CONNECTED";

  createdAt: string;
  updatedAt: string;
}
