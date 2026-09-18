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
  getDecisionsHandler,
} from "./handlers/decision-handler.js";

import {
  createGrantHandler,
  revokeGrantHandler,
  listGrantsHandler,
} from "./handlers/grant-handler.js";

import {
  createAp2MandateHandler,
} from "./handlers/ap2-handler.js";

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

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "kavachpay-backend",
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

  app.use("/v0", cognitoAuthMiddleware);

  /*
   * ── Razorpay Standard Web Checkout API ─────────────────────────────────────
   */

  app.get("/api/config", getCheckoutConfigHandler);
  app.post("/api/create-order", createOrderHandler);
  app.post("/api/execute-order", executeOrderHandler);
  app.post("/api/verify-payment", verifyPaymentHandler);

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

  app.post(
    "/v0/intents/:id/deny",
    denyIntentHandler
  );

  app.post(
    "/v0/demo/reset",
    resetDemoHandler
  );

  app.get(
    "/v0/intents/:intentId/decisions",
    getDecisionsHandler
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
╚══════════════════════════════════════╝
    `);
  });
}
