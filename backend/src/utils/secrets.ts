import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

let cachedSecrets: Record<string, string> | null = null;

const client = new SecretsManagerClient({
  region: process.env.AWS_REGION || "ap-south-1",
});

export async function loadSecrets(): Promise<void> {
  if (cachedSecrets) return;

  if (
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET &&
    process.env.RAZORPAY_WEBHOOK_SECRET
  ) {
    cachedSecrets = {
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
      RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
      RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
    };
    return;
  }

  const secretArn = process.env.RAZORPAY_SECRET_ARN || "kavachpay/razorpay";

  try {
    console.log("[Secrets] Fetching Razorpay secret from Secrets Manager");

    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretArn,
      })
    );

    if (!response.SecretString) {
      throw new Error("Razorpay secret contains no SecretString");
    }

    const parsed = JSON.parse(response.SecretString);

    if (
      !parsed.RAZORPAY_KEY_ID ||
      !parsed.RAZORPAY_KEY_SECRET ||
      !parsed.RAZORPAY_WEBHOOK_SECRET
    ) {
      throw new Error(
        "Razorpay secret is missing one or more required fields"
      );
    }

    cachedSecrets = parsed;

    process.env.RAZORPAY_KEY_ID = parsed.RAZORPAY_KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = parsed.RAZORPAY_KEY_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET =
      parsed.RAZORPAY_WEBHOOK_SECRET;

    console.log("[Secrets] Razorpay secrets loaded successfully");
  } catch (error) {
    console.error("[Secrets] Failed to load Razorpay secrets:", error);
    throw error;
  }
}
