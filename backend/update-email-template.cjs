const fs = require("node:fs");
const path = require("node:path");
const {
  CognitoIdentityProviderClient,
  DescribeUserPoolCommand,
  UpdateUserPoolCommand,
} = require("@aws-sdk/client-cognito-identity-provider");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const region = process.env.COGNITO_REGION || process.env.AWS_REGION || "ap-south-1";
const userPoolId = process.env.COGNITO_USER_POOL_ID?.trim();
const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

if (!userPoolId) {
  console.error("❌ COGNITO_USER_POOL_ID is not defined in .env");
  process.exit(1);
}

const templatePath = path.resolve(__dirname, "src/templates/otp-email.html");
const emailHtml = fs.readFileSync(templatePath, "utf-8");

const client = new CognitoIdentityProviderClient({
  region,
  credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
});

async function run() {
  console.log(`🔍 Fetching current configuration for User Pool: ${userPoolId}...`);
  const describeRes = await client.send(
    new DescribeUserPoolCommand({ UserPoolId: userPoolId })
  );

  const pool = describeRes.UserPool;
  if (!pool) {
    throw new Error("User pool not found");
  }

  console.log(`📦 Found pool "${pool.Name}". Updating email verification template...`);

  const subject = "🛡️ KavachPay — Your verification code is {####}";

  await client.send(
    new UpdateUserPoolCommand({
      UserPoolId: userPoolId,
      AutoVerifiedAttributes: pool.AutoVerifiedAttributes,
      Policies: pool.Policies,
      AccountRecoverySetting: pool.AccountRecoverySetting,
      EmailConfiguration: pool.EmailConfiguration,
      LambdaConfig: pool.LambdaConfig,
      MfaConfiguration: pool.MfaConfiguration,
      DeviceConfiguration: pool.DeviceConfiguration,
      SmsConfiguration: pool.SmsConfiguration,
      UserPoolTags: pool.UserPoolTags,
      AdminCreateUserConfig: pool.AdminCreateUserConfig,
      UserPoolAddOns: pool.UserPoolAddOns,
      VerificationMessageTemplate: {
        ...pool.VerificationMessageTemplate,
        DefaultEmailOption: "CONFIRM_WITH_CODE",
        EmailMessage: emailHtml,
        EmailSubject: subject,
      },
    })
  );

  console.log("✅ Successfully updated Cognito email verification template!");
  console.log(`📧 Subject: ${subject}`);
  console.log(`📄 Template: Loaded from src/templates/otp-email.html (${emailHtml.length} bytes)`);
}

run().catch((err) => {
  console.error("❌ Failed to update Cognito User Pool:", err);
  process.exit(1);
});
