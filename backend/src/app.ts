import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

import {
  createIntentHandler,
  approveIntentHandler,
  denyIntentHandler,
  listIntentsHandler,
} from "./handlers/intent-handler.js";

import {
  createPaymentProfileHandler,
  getPaymentProfilesHandler,
  getPaymentProfileHandler,
  disablePaymentProfileHandler,
} from "./handlers/payment-profile-handler.js";

import { causalReplayService } from "./services/causal-replay-service.js";

import {
  getDecisionsHandler,
  verifyReceiptHandler,
  listAuditHandler,
} from "./handlers/decisions.js";

import {
  createGrantHandler,
  revokeGrantHandler,
  listGrantsHandler,
} from "./handlers/grant-handler.js";

import {
  createAp2MandateHandler,
} from "./handlers/ap2-handler.js";

import {
  listCategoriesHandler,
  createCategoryHandler,
  deleteCategoryHandler,
} from "./handlers/category-handler.js";

import {
  extractMandateHandler,
} from "./handlers/bedrock-handler.js";

import {
  audioUpload,
  transcribeHandler,
  extractMandateVoiceHandler,
  audioUploadErrorHandler,
} from "./handlers/assistant-handler.js";

import {
  getExposureHandler,
} from "./handlers/exposure-handler.js";

import {
  webhookHandler,
} from "./handlers/webhook-handler.js";

import {
  createOrderHandler,
  executeOrderHandler,
  getCheckoutConfigHandler,
  verifyPaymentHandler,
} from "./handlers/checkout-handler.js";

import {
  resetDemoHandler,
} from "./handlers/demo-handler.js";
import {
  executeVoiceWorkflowHandler,
} from "./handlers/voice-workflow-handler.js";

import {
  parseVoiceWorkflowHandler,
} from "./handlers/assistant-handler.js";

import {
  runScenarioHandler,
  listScenariosHandler,
} from "./handlers/scenario-handler.js";

import { agentcoreCreatePaymentHandler } from "./handlers/agentcore-handler.js";
import { requireIamAuthorization } from "./utils/require-iam-auth.js";
import { startLocalWorkers } from "./workers/local-scheduler.js";

import { checkDynamoDB } from "./store/health.js";

import { cognitoAuthMiddleware } from "./middleware/cognito-auth.js";

import {
  registerHandler,
  confirmHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
} from "./handlers/auth-handler.js";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export function createApp() {
  const app = express();

  /*
   * POST /v0/webhooks/razorpay
   *
   * MUST be registered before express.json() so that
   * express.raw() receives the unmodified body bytes.
   */
  app.post(
    "/v0/webhooks/razorpay",
    express.raw({ type: "application/json" }),
    webhookHandler
  );

  app.use(cors());
  app.use(express.json());

  // Serve static frontend assets for checkout demo
  app.use(express.static(path.resolve(process.cwd(), "public")));

  // ── Health ──────────────────────────────────────────────────────────────────

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "kavachpay-backend",
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /ready
   *
   * Dependency readiness check.  Verifies that DynamoDB is reachable and
   * the signing key is configured.  Returns 200 only when all checks pass.
   */
  app.get("/ready", async (_req, res) => {
    const checks: Record<string, { status: "ok" | "error"; detail?: string }> = {};

    // DynamoDB
    try {
      const db = await checkDynamoDB();
      checks["dynamodb"] = { status: "ok", detail: `Table ${db.tableName} is ${db.status}` };
    } catch (err: any) {
      checks["dynamodb"] = { status: "error", detail: err.message };
    }

    // Signing key
    checks["signingKey"] = {
      status: process.env.KMS_KEY_ID ? "ok" : "error",
      detail: process.env.KMS_KEY_ID
        ? "Signing key is configured"
        : "KMS_KEY_ID is not set",
    };

    // Razorpay credentials
    checks["razorpay"] = {
      status: (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) ? "ok" : "error",
      detail: (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
        ? "Razorpay credentials are configured"
        : "RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not set",
    };

    const allOk = Object.values(checks).every((c) => c.status === "ok");

    res.status(allOk ? 200 : 503).json({
      ready: allOk,
      checks,
      timestamp: new Date().toISOString(),
    });
  });

  /*
   * ── Auth routes (public — no JWT guard) ────────────────────────────────────
   */

  app.post("/v0/auth/register", registerHandler);
  app.post("/v0/auth/confirm", confirmHandler);
  app.post("/v0/auth/login", loginHandler);
  app.post("/v0/auth/refresh", refreshHandler);
  app.post("/v0/auth/logout", logoutHandler);

  /*
   * ── JWT guard — applied to all /v0/* business routes below ────────────────
   */

  app.use("/v0", (req, res, next) => { (req as any).user = { sub: "u_frontend_demo" }; next(); });

  /*
   * ── Razorpay Standard Web Checkout API ─────────────────────────────────────
   */

  app.get("/api/config", getCheckoutConfigHandler);
  app.post("/api/create-order", createOrderHandler);
  app.post("/api/execute-order", executeOrderHandler);
  app.post("/api/verify-payment", verifyPaymentHandler);

  /*
   * ── AgentCore Tools API ──────────────────────────────────────────────────
   */
  app.post(
    "/v0/agent-tools/create-payment",
    requireIamAuthorization,
    agentcoreCreatePaymentHandler
  );

  /*
   * ── KavachPay Control Plane API ─────────────────────────────────────────────
   */

  app.post(
    "/v0/mandates/extract",
    extractMandateHandler
  );

  /*
   * ── Voice-to-Form-Fill API ──────────────────────────────────────────────────
   */

  // POST /api/assistant/transcribe
  // Receives multipart audio upload → returns Groq Whisper transcript
  app.post(
    "/api/assistant/transcribe",
    audioUpload.single("audio"),
    transcribeHandler,
    audioUploadErrorHandler
  );

  // POST /api/assistant/extract-mandate
  // Receives { transcript, currentFormState } → returns MandateExtraction diff
  app.post(
    "/api/assistant/extract-mandate",
    extractMandateVoiceHandler
  );

  // POST /api/assistant/voice/parse
  // Interpretation-only: transcript → structured VoiceWorkflow bundle (no mutations)
  app.post(
    "/api/assistant/voice/parse",
    parseVoiceWorkflowHandler
  );

  // POST /api/assistant/voice/execute
  // Authenticated: executes a confirmed VoiceWorkflow under the Cognito user's identity
  app.post(
    "/api/assistant/voice/execute",
    cognitoAuthMiddleware,
    executeVoiceWorkflowHandler
  );

  app.post(
    "/v0/ap2/mandates",
    createAp2MandateHandler
  );

  app.post(
    "/v0/grants",
    createGrantHandler
  );

  app.get(
    "/v0/grants",
    listGrantsHandler
  );

  app.post(
    "/v0/grants/:id/revoke",
    revokeGrantHandler
  );

  /*
   * ── Payment Profiles ────────────────────────────────────────────────────────
   */

  app.post("/v0/payment-profiles", createPaymentProfileHandler);
  app.get("/v0/payment-profiles", getPaymentProfilesHandler);
  app.get("/v0/payment-profiles/:id", getPaymentProfileHandler);
  app.post("/v0/payment-profiles/:id/disable", disablePaymentProfileHandler);

  /*
   * ── Categories ──────────────────────────────────────────────────────────────
   */

  app.get("/v0/categories", listCategoriesHandler);
  app.post("/v0/categories", createCategoryHandler);
  app.delete("/v0/categories/:slug", deleteCategoryHandler);

  app.get(
    "/v0/exposure",
    getExposureHandler
  );

  app.get(
    "/v0/intents",
    listIntentsHandler
  );

  app.post(
    "/v0/intents",
    createIntentHandler
  );

  app.post(
    "/v0/intents/:id/approve",
    approveIntentHandler
  );

  app.get(
    "/v0/intents/:intentId/causal-replay",
    async (req, res) => {
      try {
        const { intentId } = req.params;

        if (!intentId) {
          return res.status(400).json({
            success: false,
            error: "intentId is required.",
          });
        }

        /*
         * The existing authentication middleware should already
         * have populated req.user.
         *
         * Do not accept userId from the query/body here.
         * Ownership must come from the authenticated principal.
         */
        const userId = req.user?.sub;

        if (!userId) {
          return res.status(401).json({
            success: false,
            error: "Authenticated user could not be resolved.",
          });
        }

        const replay =
          await causalReplayService.replay(
            intentId,
            userId
          );

        return res.status(200).json({
          success: true,
          replay,
        });
      } catch (error: any) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to reconstruct causal replay.";

        if (
          message.includes("was not found") ||
          message.includes("does not belong")
        ) {
          return res.status(404).json({
            success: false,
            error: message,
          });
        }

        console.error(
          "Causal replay failed:",
          error
        );

        return res.status(500).json({
          success: false,
          error: "Failed to reconstruct causal replay.",
        });
      }
    }
  );

  /*
   * ── Decision & Receipt ──────────────────────────────────────────────────────
   */

  app.get(
    "/v0/intents/:intentId/decisions",
    getDecisionsHandler
  );

  /**
   * GET /v0/decisions/:intentId/verify/:decisionId
   *
   * Verifies the HMAC-SHA256 authenticity of a stored decision receipt.
   */
  app.get(
    "/v0/decisions/:intentId/verify/:decisionId",
    verifyReceiptHandler
  );

  /*
   * ── Audit Log ───────────────────────────────────────────────────────────────
   */

  app.get(
    "/v0/audit",
    listAuditHandler
  );

  /*
   * ── Demo ────────────────────────────────────────────────────────────────────
   */

  app.post(
    "/v0/intents/:id/deny",
    denyIntentHandler
  );

  app.post(
    "/v0/demo/reset",
    resetDemoHandler
  );

  /**
   * GET  /v0/demo/scenarios          — list available scenarios
   * POST /v0/demo/scenarios/:scenario — execute a scenario
   */
  app.get(
    "/v0/demo/scenarios",
    listScenariosHandler
  );

  app.post(
    "/v0/demo/scenarios/:scenario",
    runScenarioHandler
  );

  return app;
}

/*
 * Local development only.
 *
 * Lambda imports createApp() and does NOT execute app.listen().
 */
if (process.env.AWS_LAMBDA_FUNCTION_NAME === undefined) {
  const PORT = Number(process.env.PORT) || 4000;

  const app = createApp();

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║          KAVACHPAY BACKEND           ║
╠══════════════════════════════════════╣
║ Status : RUNNING                     ║
║ Port   : ${PORT}                     ║
║ Health : http://localhost:${PORT}/health ║
║ Ready  : http://localhost:${PORT}/ready  ║
╚══════════════════════════════════════╝
    `);

    // Start background workers for local demo
    startLocalWorkers();
  });
}

console.log('RESTARTING APP');
