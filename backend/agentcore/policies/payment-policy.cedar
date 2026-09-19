// Amazon Bedrock AgentCore Cedar Policy
// This permits the authorized agent principal to invoke the create_payment tool on the KavachPay Gateway.
// The placeholders {{GATEWAY_RESOURCE}} and {{CREATE_PAYMENT_ACTION}} will be replaced by the deploy script.

permit(
    principal,
    action == {{CREATE_PAYMENT_ACTION}},
    resource == {{GATEWAY_RESOURCE}}
)
when {
    // Only allow agents that have been authenticated and granted the 'payment_agent' role
    context.agent.role == "payment_agent"
};
