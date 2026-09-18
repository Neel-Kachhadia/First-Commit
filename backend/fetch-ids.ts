import { runScenarioHandler } from "./src/handlers/scenario-handler.js";
import { intentRepository } from "./src/store/intent-repository.js";
import { decisionRepository } from "./src/store/decision-repository.js";

async function run() {
  const req = { params: { scenario: "happy-path" } };
  const res = {
    status: (code: number) => ({
      json: async (data: any) => {
        // Find the most recent intent and decision for DEMO_USER
        const intents = await intentRepository.listUserIntents("u_frontend_demo");
        const latestIntent = intents[0];
        const latestDecision = await decisionRepository.getLatestDecision(latestIntent.intentId);
        
        console.log(JSON.stringify({
          intentId: latestIntent.intentId,
          decisionId: latestDecision?.decisionId
        }));
      }
    })
  };
  
  await runScenarioHandler(req as any, res as any);
}
run();
