import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

export class KavachPayStack extends cdk.Stack {
  public readonly kavachPayTable: dynamodb.Table;
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(
    scope: Construct,
    id: string,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

    // ── DynamoDB ──────────────────────────────────────────────────────────────

    this.kavachPayTable = new dynamodb.Table(this, "KavachPayTable", {
      tableName: "kavachpay-dev",

      partitionKey: {
        name: "PK",
        type: dynamodb.AttributeType.STRING,
      },

      sortKey: {
        name: "SK",
        type: dynamodb.AttributeType.STRING,
      },

      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },

      removalPolicy: cdk.RemovalPolicy.DESTROY,

      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    new cdk.CfnOutput(this, "KavachPayTableName", {
      value: this.kavachPayTable.tableName,
      description: "KavachPay DynamoDB table name",
    });

    new cdk.CfnOutput(this, "KavachPayTableArn", {
      value: this.kavachPayTable.tableArn,
      description: "KavachPay DynamoDB table ARN",
    });

    // ── Cognito User Pool ─────────────────────────────────────────────────────

    this.userPool = new cognito.UserPool(this, "KavachPayUserPool", {
      userPoolName: "kavachpay-dev-users",

      // Email is the login identifier; no username alias.
      signInAliases: { email: true },
      autoVerify: { email: true },

      // Email verification is REQUIRED before a user can sign in.
      // This is a finance app — unverified identities must not get access.
      userVerification: {
        emailSubject: "KavachPay — Verify your email",
        emailBody:
          "Your KavachPay verification code is {####}. " +
          "This code expires in 24 hours.",
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },

      // Strong password policy for a finance context.
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false, // keep UX reasonable; backend can enforce more
        tempPasswordValidity: cdk.Duration.days(3),
      },

      selfSignUpEnabled: true,

      // Standard attributes captured at registration.
      standardAttributes: {
        email: { required: true, mutable: false },
      },

      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,

      // For dev: keep the pool if you accidentally run `cdk destroy`.
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ── Cognito App Client ────────────────────────────────────────────────────

    this.userPoolClient = this.userPool.addClient("KavachPayWebClient", {
      userPoolClientName: "kavachpay-web",

      // Public SPA client — no client secret (Amplify requirement).
      generateSecret: false,

      authFlows: {
        userPassword: true,   // USER_PASSWORD_AUTH (Amplify default)
        userSrp: true,        // USER_SRP_AUTH (recommended for security)
        custom: false,
        adminUserPassword: false,
      },

      // Token validity windows suitable for a finance app.
      idTokenValidity: cdk.Duration.hours(1),
      accessTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),

      preventUserExistenceErrors: true,
    });

    new cdk.CfnOutput(this, "KavachPayUserPoolId", {
      value: this.userPool.userPoolId,
      description: "Cognito User Pool ID",
    });

    new cdk.CfnOutput(this, "KavachPayUserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
      description: "Cognito App Client ID",
    });
  }
}
