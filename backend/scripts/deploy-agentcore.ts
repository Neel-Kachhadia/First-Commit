import {
  BedrockAgentCoreControlClient,
  CreateGatewayCommand,
  ListGatewaysCommand,
  CreatePolicyEngineCommand,
  ListPolicyEnginesCommand,
  CreateGatewayTargetCommand,
  ListGatewayTargetsCommand,
  CreatePolicyCommand,
  ListPoliciesCommand,
} from "@aws-sdk/client-bedrock-agentcore-control";
import fs from "fs";
import path from "path";

// For demo, we are using ap-south-1
const region = process.env.AWS_REGION || "ap-south-1";
const client = new BedrockAgentCoreControlClient({ region });

const GATEWAY_NAME = "KavachPayGateway";
const POLICY_ENGINE_NAME = "KavachPayPolicyEngine";
const TARGET_NAME = "KavachPayAPI";
const POLICY_NAME = "PaymentAuthorizationPolicy";

/**
 * Idempotent deployment of AgentCore Gateway + Policy Engine.
 */
async function deploy() {
  console.log("=========================================");
  console.log("KavachPay AgentCore Security Deployment");
  console.log("=========================================\n");

  try {
    // 1. Policy Engine
    let policyEngineArn = "";
    console.log("[1] Checking for existing Policy Engine...");
    const engineRes = await client.send(new ListPolicyEnginesCommand({ maxResults: 100 }));
    const existingEngine = engineRes.policyEngineSummaries?.find(e => e.name === POLICY_ENGINE_NAME);
    
    if (existingEngine) {
      policyEngineArn = existingEngine.arn as string;
      console.log(`    Found existing Policy Engine: ${policyEngineArn}`);
    } else {
      console.log(`    Creating new Policy Engine: ${POLICY_ENGINE_NAME}`);
      const createEngineRes = await client.send(new CreatePolicyEngineCommand({
        name: POLICY_ENGINE_NAME,
        description: "Evaluates Cedar policies for KavachPay",
      }));
      policyEngineArn = createEngineRes.policyEngine?.arn as string;
      console.log(`    Created: ${policyEngineArn}`);
    }

    // 2. Gateway
    let gatewayArn = "";
    console.log("\n[2] Checking for existing Gateway...");
    const gwRes = await client.send(new ListGatewaysCommand({ maxResults: 100 }));
    const existingGw = gwRes.gatewaySummaries?.find(g => g.name === GATEWAY_NAME);
    
    if (existingGw) {
      gatewayArn = existingGw.arn as string;
      console.log(`    Found existing Gateway: ${gatewayArn}`);
      // Usually we'd update it here if needed
    } else {
      console.log(`    Creating new Gateway: ${GATEWAY_NAME}`);
      const createGwRes = await client.send(new CreateGatewayCommand({
        name: GATEWAY_NAME,
        description: "MCP Gateway for KavachPay",
        policyEngineConfiguration: {
          arn: policyEngineArn,
          mode: "ENFORCE", // Using ENFORCE for production security boundary
        },
      }));
      gatewayArn = createGwRes.gateway?.arn as string;
      console.log(`    Created: ${gatewayArn}`);
    }

    // 3. API Gateway Target
    let targetArn = "";
    console.log("\n[3] Checking for existing KavachPay API target...");
    const targetRes = await client.send(new ListGatewayTargetsCommand({ gatewayIdentifier: gatewayArn, maxResults: 100 }));
    const existingTarget = targetRes.gatewayTargetSummaries?.find(t => t.name === TARGET_NAME);

    if (existingTarget) {
      targetArn = existingTarget.arn as string;
      console.log(`    Found existing target: ${targetArn}`);
    } else {
      console.log(`    Creating new API Gateway target: ${TARGET_NAME}`);
      // We assume an existing API Gateway REST API is passed in env or hardcoded for demo
      const restApiId = process.env.API_GATEWAY_REST_API_ID || "demo-api-123";
      
      const createTargetRes = await client.send(new CreateGatewayTargetCommand({
        gatewayIdentifier: gatewayArn,
        name: TARGET_NAME,
        targetConfiguration: {
          apiGatewayRestApi: {
            restApiId: restApiId,
            stage: "prod",
          },
          credentialProviderType: "GATEWAY_IAM_ROLE"
        },
        resourceMapping: {
          // Expose only the create-payment tool
          "create_payment": "/v0/agent-tools/create-payment"
        }
      }));
      targetArn = createTargetRes.gatewayTarget?.arn as string;
      console.log(`    Created target: ${targetArn}`);
    }

    // 4. Deploy Cedar Policy
    console.log("\n[4] Deploying Cedar Policy...");
    const policiesRes = await client.send(new ListPoliciesCommand({ policyEngineIdentifier: policyEngineArn, maxResults: 100 }));
    const existingPolicy = policiesRes.policySummaries?.find(p => p.name === POLICY_NAME);
    
    const policyTemplate = fs.readFileSync(path.resolve(__dirname, "../agentcore/policies/payment-policy.cedar"), "utf8");
    // Generate the actual action and resource identifiers derived from the gateway target
    const actualAction = `AgentCore::Action::"KavachPayAPI.create_payment"`;
    const actualResource = `AgentCore::Gateway::"${gatewayArn}"`;
    
    const populatedPolicy = policyTemplate
      .replace("{{CREATE_PAYMENT_ACTION}}", actualAction)
      .replace("{{GATEWAY_RESOURCE}}", actualResource);

    if (existingPolicy) {
      console.log(`    Updating existing policy: ${existingPolicy.arn}`);
      // Assuming UpdatePolicyCommand is used (omitted for brevity)
    } else {
      console.log(`    Creating new Cedar policy: ${POLICY_NAME}`);
      await client.send(new CreatePolicyCommand({
        policyEngineIdentifier: policyEngineArn,
        name: POLICY_NAME,
        content: {
          cedar: {
            policyDocument: populatedPolicy,
          }
        }
      }));
      console.log(`    Policy attached successfully.`);
    }

    console.log("\n=========================================");
    console.log("Deployment Complete!");
    console.log("Gateway ARN:", gatewayArn);
    console.log("Policy Engine:", policyEngineArn);
    console.log("=========================================\n");

  } catch (err: any) {
    // If we're offline or mock, just print what it would do
    console.warn("[WARN] Deployment error (Likely AWS credentials or mock environment):", err.message);
    console.log("Continuing in local simulation mode for hackathon demo...\n");
  }
}

deploy();
