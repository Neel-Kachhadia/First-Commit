import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import {
  createIntentHandler,
} from "./handlers/intent-handler.js";

import {
  createGrantHandler,
} from "./handlers/grant-handler.js";

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
  "/v0/intents",
  createIntentHandler
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
