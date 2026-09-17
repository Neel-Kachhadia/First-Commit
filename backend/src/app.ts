import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import {
  createIntentHandler,
  approveIntentHandler,
} from "./handlers/intent-handler.js";

import {
  getDecisionsHandler,
} from "./handlers/decision-handler.js";

import {
  createGrantHandler,
  revokeGrantHandler,
} from "./handlers/grant-handler.js";

import {
  createAp2MandateHandler,
} from "./handlers/ap2-handler.js";

import {
  extractMandateHandler,
} from "./handlers/bedrock-handler.js";

import {
  getExposureHandler,
} from "./handlers/exposure-handler.js";

import {
  webhookHandler,
} from "./handlers/webhook-handler.js";

import path from "path";

import {
  createOrderHandler,
  verifyPaymentHandler,
  getCheckoutConfigHandler,
} from "./handlers/checkout-handler.js";

dotenv.config();

const app = express();

const PORT =
  Number(process.env.PORT) || 4000;

/*
 * POST /v0/webhooks/razorpay
 *
 * MUST be registered before express.json() so that
 * express.raw() receives the unmodified body bytes.
 * Razorpay HMAC-SHA256 verification requires the raw body.
 *
 * @see https://razorpay.com/docs/webhooks/validate-test/
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
    timestamp:
      new Date().toISOString(),
  });
});

/*
 * ── Razorpay Standard Web Checkout API ───────────────────────────────────────
 */
app.get("/api/config", getCheckoutConfigHandler);
app.post("/api/create-order", createOrderHandler);
app.post("/api/verify-payment", verifyPaymentHandler);

/*
 * ── KavachPay Control Plane API ──────────────────────────────────────────────
 */

app.post(
  "/v0/mandates/extract",
  extractMandateHandler
);

app.post(
  "/v0/ap2/mandates",
  createAp2MandateHandler
);

app.post(
  "/v0/grants",
  createGrantHandler
);

app.post(
  "/v0/grants/:id/revoke",
  revokeGrantHandler
);

app.get(
  "/v0/exposure",
  getExposureHandler
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
  "/v0/intents/:intentId/decisions",
  getDecisionsHandler
);

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
