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
  getExposureHandler,
} from "./handlers/exposure-handler.js";

dotenv.config();

const app = express();

const PORT =
  Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "kavachpay-backend",
    timestamp:
      new Date().toISOString(),
  });
});

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
