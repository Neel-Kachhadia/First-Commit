import { causalReplayService } from "./src/services/causal-replay-service.js";

async function run() {
  const intentId = "i_00749baa-84a3-4286-9350-c263d548a023";
  const userId = "u_frontend_demo";
  
  try {
    const replay = await causalReplayService.replay(intentId, userId);
    console.log(JSON.stringify(replay, null, 2));
  } catch (error) {
    console.error("Failed to generate replay:", error);
  }
}

run().catch(console.error);
