import { createHash, verify, constants } from "crypto";
import { KMSClient, SignCommand, GetPublicKeyCommand } from "@aws-sdk/client-kms";
import type { Decision } from "../models/decision.js";
import { decisionRepository } from "../store/decision-repository.js";
import type { ReconciliationRecord } from "../store/reconciliation-repository.js";

const kmsClient = new KMSClient({ region: process.env.AWS_REGION || "ap-south-1" });

/**
 * KavachPay Decision Receipt Service
 *
 * Produces cryptographically authenticated decision receipts using AWS KMS Asymmetric RSA signatures.
 * 
 * Verification is performed locally by retrieving the KMS public key, meaning external parties
 * can verify receipts independently without needing access to the private signing key or 
 * IAM permissions to call kms:Verify.
 *
 * Receipt structure:
 *
 *   canonical JSON payload
 *         ↓
 *    SHA-256 hash (receiptHash)
 *         ↓
 *   AWS-KMS-RSASSA_PSS_SHA_256 (signature)
 *         ↓
 *   stored in DynamoDB alongside the decision
 */

function getKmsKeyId(): string {
  const keyId = process.env.KMS_KEY_ID;
  if (!keyId) {
    throw new Error(
      "[ReceiptService] KMS_KEY_ID is not set. " +
      "Production and AWS deployments require a valid KMS key. " +
      "Ensure the environment variable is configured."
    );
  }
  return keyId;
}

// In-memory cache for the KMS public key (PEM format)
let cachedPublicKeyPem: string | null = null;

async function getPublicKeyPem(keyId: string): Promise<string> {
  if (cachedPublicKeyPem) {
    return cachedPublicKeyPem;
  }
  
  const response = await kmsClient.send(new GetPublicKeyCommand({ KeyId: keyId }));
  if (!response.PublicKey) {
    throw new Error("Failed to retrieve public key from KMS.");
  }
  
  // KMS returns the DER-encoded X.509 public key in PublicKey (Uint8Array)
  // Convert it to PEM format for Node's crypto.verify
  const base64Der = Buffer.from(response.PublicKey).toString("base64");
  const pem = `-----BEGIN PUBLIC KEY-----\n${base64Der.match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;
  
  cachedPublicKeyPem = pem;
  return pem;
}

export interface ReceiptContext {
  /**
   * Grant IDs from root → target, in authority path order.
   */
  authorityPath?: string[];

  /**
   * Remaining budget on each grant before the reservation was applied.
   */
  stateBefore?: Record<string, number>;

  /**
   * Remaining budget on each grant after the reservation was applied.
   */
  stateAfter?: Record<string, number>;
}

export class ReceiptService {
  /**
   * Finalizes a decision by:
   *  1. Building the canonical receipt payload (including pre/post state snapshots)
   *  2. Computing SHA-256 receiptHash over the canonical payload
   *  3. Computing HMAC-SHA256 signature over the receiptHash
   *  4. Persisting both the decision and its receipt to DynamoDB
   */
  async finalizeDecision(
    decision: Decision,
    context?: ReceiptContext
  ): Promise<Decision> {
    const canonicalPayload = {
      intentId: decision.intentId,
      decisionId: decision.decisionId,
      grantId: decision.grantId,
      decision: decision.decision,
      reasonCode: decision.reasonCode,
      amount: decision.amount,
      currency: decision.currency,
      effectiveCapacity: decision.effectiveCapacity,
      grantResidual: decision.grantResidual,
      reserved: decision.reserved,
      createdAt: decision.createdAt,
      // Optional enrichment fields (included when present)
      ...(context?.authorityPath && { authorityPath: context.authorityPath }),
      ...(context?.stateBefore && { stateBefore: context.stateBefore }),
      ...(context?.stateAfter && { stateAfter: context.stateAfter }),
    };

    // 1. Deterministic SHA-256 hash of the canonical payload
    const receiptHash = createHash("sha256")
      .update(JSON.stringify(canonicalPayload))
      .digest("hex");
    
    // We need the raw binary digest for KMS
    const digestBuffer = Buffer.from(receiptHash, "hex");

    // 2. AWS KMS Asymmetric RSA Signature over the digest
    const keyId = getKmsKeyId();
    const signResponse = await kmsClient.send(
      new SignCommand({
        KeyId: keyId,
        Message: digestBuffer,
        MessageType: "DIGEST",
        SigningAlgorithm: "RSASSA_PSS_SHA_256",
      })
    );

    if (!signResponse.Signature) {
      throw new Error("KMS did not return a signature.");
    }

    const signature = Buffer.from(signResponse.Signature).toString("base64");

    decision.receiptHash = receiptHash;

    // 3. Persist the main decision record
    await decisionRepository.createDecision(decision);

    // 4. Persist the standalone immutable receipt
    await decisionRepository.createReceipt(decision, receiptHash, {
      signature,
      algorithm: "RSASSA_PSS_SHA_256",
      keyId,
      signedAt: new Date().toISOString(),
      authorityPath: context?.authorityPath,
      stateBefore: context?.stateBefore,
      stateAfter: context?.stateAfter,
    });

    console.log(`[ReceiptService] Decision receipt ${decision.decisionId} created and signed via KMS.`);
    return decision;
  }

  /**
   * Finalizes a reconciliation event by computing its hash and signing it.
   */
  async signReconciliationEvent(
    record: ReconciliationRecord
  ): Promise<{ receiptHash: string; signature: string; keyId: string; signedAt: string; algorithm: string }> {
    const receiptHash = createHash("sha256")
      .update(JSON.stringify(record))
      .digest("hex");
    
    const digestBuffer = Buffer.from(receiptHash, "hex");
    const keyId = getKmsKeyId();
    
    const signResponse = await kmsClient.send(
      new SignCommand({
        KeyId: keyId,
        Message: digestBuffer,
        MessageType: "DIGEST",
        SigningAlgorithm: "RSASSA_PSS_SHA_256",
      })
    );

    if (!signResponse.Signature) {
      throw new Error("KMS did not return a signature for reconciliation event.");
    }

    const signature = Buffer.from(signResponse.Signature).toString("base64");

    return {
      receiptHash,
      signature,
      keyId,
      algorithm: "RSASSA_PSS_SHA_256",
      signedAt: new Date().toISOString(),
    };
  }

  /**
   * Reconstructs the canonical payload, computes the SHA-256 digest,
   * and verifies the signature using the KMS public key.
   *
   * Returns true only if both the hash and the signature are valid.
   */
  async verifyReceipt(
    intentId: string,
    decisionId: string
  ): Promise<{
    valid: boolean;
    algorithm: string;
    signature: string;
    receiptHash: string;
    signedAt: string;
    authorityPath?: string[];
    stateBefore?: Record<string, number>;
    stateAfter?: Record<string, number>;
    error?: string;
  }> {
    const receipt = await decisionRepository.getReceipt(intentId, decisionId);
    const decision = await decisionRepository.getDecision(intentId, decisionId);

    if (!receipt || !decision) {
      return {
        valid: false,
        algorithm: "RSASSA_PSS_SHA_256",
        signature: "",
        receiptHash: "",
        signedAt: "",
        error: "Receipt or decision not found.",
      };
    }

    // Reconstruct canonical payload
    const canonicalPayload = {
      intentId: decision.intentId,
      decisionId: decision.decisionId,
      grantId: decision.grantId,
      decision: decision.decision,
      reasonCode: decision.reasonCode,
      amount: decision.amount,
      currency: decision.currency,
      effectiveCapacity: decision.effectiveCapacity,
      grantResidual: decision.grantResidual,
      reserved: decision.reserved,
      createdAt: decision.createdAt,
      ...(receipt.authorityPath && { authorityPath: receipt.authorityPath }),
      ...(receipt.stateBefore && { stateBefore: receipt.stateBefore }),
      ...(receipt.stateAfter && { stateAfter: receipt.stateAfter }),
    };

    // Verify asymmetric signature locally against the full payload
    let valid = false;
    try {
      const keyId = getKmsKeyId();
      const publicKeyPem = await getPublicKeyPem(keyId);

      const payloadBuffer = Buffer.from(JSON.stringify(canonicalPayload), "utf8");
      const signatureBuffer = Buffer.from(receipt.signature, "base64");

      valid = verify(
        "sha256",
        payloadBuffer,
        {
          key: publicKeyPem,
          padding: constants.RSA_PKCS1_PSS_PADDING,
          saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
        },
        signatureBuffer
      );
    } catch (e: any) {
      console.error("[ReceiptService] Verification error:", e);
      valid = false;
    }

    return {
      valid,
      algorithm: receipt.algorithm,
      signature: receipt.signature,
      receiptHash: receipt.receiptHash,
      signedAt: receipt.signedAt,
      authorityPath: receipt.authorityPath,
      stateBefore: receipt.stateBefore,
      stateAfter: receipt.stateAfter,
      ...(!valid && { error: "Signature mismatch — receipt may have been tampered with." }),
    };
  }
}

export const receiptService = new ReceiptService();
