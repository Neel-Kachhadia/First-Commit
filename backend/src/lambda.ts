import serverless from "serverless-http";
import { createApp } from "./app.js";
import { loadSecrets } from "./utils/secrets.js";

let appHandler: any;

export const handler = async (event: any, context: any) => {
  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method !== "OPTIONS") {
    await loadSecrets();
  }
  
  if (!appHandler) {
    const app = createApp();
    appHandler = serverless(app, {
      binary: ["*/*"],
    });
  }
  
  return appHandler(event, context);
};
