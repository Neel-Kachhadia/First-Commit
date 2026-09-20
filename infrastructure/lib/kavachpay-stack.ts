import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as kms from "aws-cdk-lib/aws-kms";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as path from "path";
import * as fs from "fs";
import { Construct } from "constructs";

export class KavachPayStack extends cdk.Stack {
  public readonly kavachPayTable: dynamodb.Table;
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  public readonly kavachPayLambda: lambdaNodejs.NodejsFunction;
  public readonly api: apigateway.RestApi;

  constructor(
    scope: Construct,
    id: string,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

    // ─────────────────────────────────────────────────────────────────────────
    // DynamoDB
    // ─────────────────────────────────────────────────────────────────────────

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

    // ─────────────────────────────────────────────────────────────────────────
    // Cognito
    // ─────────────────────────────────────────────────────────────────────────

    this.userPool = new cognito.UserPool(this, "KavachPayUserPool", {
      userPoolName: "kavachpay-dev-users",

      signInAliases: {
        email: true,
      },

      autoVerify: {
        email: true,
      },

      userVerification: {
        emailSubject: "KavachPay — Verify your email",
        emailBody:
          "Your KavachPay verification code is {####}. " +
          "This code expires in 24 hours.",
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },

      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
        tempPasswordValidity: cdk.Duration.days(3),
      },

      selfSignUpEnabled: true,

      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
      },

      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,

      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.userPoolClient = this.userPool.addClient(
      "KavachPayWebClient",
      {
        userPoolClientName: "kavachpay-web",

        generateSecret: false,

        authFlows: {
          userPassword: true,
          userSrp: true,
          custom: false,
          adminUserPassword: false,
        },

        idTokenValidity: cdk.Duration.hours(1),
        accessTokenValidity: cdk.Duration.hours(1),
        refreshTokenValidity: cdk.Duration.days(30),

        preventUserExistenceErrors: true,
      }
    );

    new cdk.CfnOutput(this, "KavachPayUserPoolId", {
      value: this.userPool.userPoolId,
      description: "Cognito User Pool ID",
    });

    new cdk.CfnOutput(this, "KavachPayUserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
      description: "Cognito App Client ID",
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Existing KMS receipt-signing key
    // ─────────────────────────────────────────────────────────────────────────

    const receiptSigningKey = kms.Key.fromLookup(
      this,
      "ReceiptSigningKey",
      {
        aliasName: "alias/kavachpay-receipt-signer",
      }
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Existing Razorpay secret
    // ─────────────────────────────────────────────────────────────────────────

    const razorpaySecret =
      secretsmanager.Secret.fromSecretNameV2(
        this,
        "RazorpaySecret",
        "kavachpay/razorpay"
      );

    // ─────────────────────────────────────────────────────────────────────────
    // Backend Lambda
    //
    // Entry:
    // backend/src/lambda.ts
    //
    // Export:
    // export const handler = ...
    // ─────────────────────────────────────────────────────────────────────────

    this.kavachPayLambda =
      new lambdaNodejs.NodejsFunction(
        this,
        "KavachPayLambda",
        {
          functionName: "KavachPayLambda",

          runtime: cdk.aws_lambda.Runtime.NODEJS_22_X,

          entry: path.join(
            __dirname,
            "../../backend/src/lambda.ts"
          ),

          projectRoot: path.join(__dirname, "../../backend"),

          depsLockFilePath: path.join(__dirname, "../../backend/package-lock.json"),

          handler: "handler",

          timeout: cdk.Duration.seconds(30),

          memorySize: 1024,

          bundling: {
            minify: false,
            sourceMap: false,

            // Lambda already provides the AWS SDK.
            externalModules: [
              "@aws-sdk/*",
            ],
          },

          environment: {
            NODE_ENV: "production",

            TABLE_NAME:
              this.kavachPayTable.tableName,

            KMS_KEY_ID:
              receiptSigningKey.keyId,

            RAZORPAY_SECRET_ARN:
              razorpaySecret.secretName,

            COGNITO_USER_POOL_ID:
              this.userPool.userPoolId,

            COGNITO_CLIENT_ID:
              this.userPoolClient.userPoolClientId,

            GEMINI_API_KEY: (() => {
              let key = process.env.GEMINI_API_KEY || "";
              try {
                const envContent = fs.readFileSync(path.join(__dirname, "../../backend/.env"), "utf-8");
                const match = envContent.match(/^GEMINI_API_KEY=(.*)$/m);
                if (match) key = match[1].trim();
              } catch (e) {
                // Ignore if .env doesn't exist
              }
              return key;
            })(),
          },
        }
      );

    // ─────────────────────────────────────────────────────────────────────────
    // Lambda → DynamoDB
    // ─────────────────────────────────────────────────────────────────────────

    this.kavachPayTable.grantReadWriteData(
      this.kavachPayLambda
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Lambda → KMS
    // ─────────────────────────────────────────────────────────────────────────

    receiptSigningKey.grantSign(
      this.kavachPayLambda
    );

    receiptSigningKey.grantVerify(
      this.kavachPayLambda
    );

    receiptSigningKey.grant(
      this.kavachPayLambda,
      "kms:GetPublicKey",
      "kms:DescribeKey"
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Lambda → Secrets Manager
    // ─────────────────────────────────────────────────────────────────────────

    razorpaySecret.grantRead(
      this.kavachPayLambda
    );
    
    // Add Bedrock permissions
    this.kavachPayLambda.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      resources: ["*"],
    }));

    // ─────────────────────────────────────────────────────────────────────────
    // API Gateway
    // ─────────────────────────────────────────────────────────────────────────

    this.api = new apigateway.RestApi(
      this,
      "KavachPayApi",
      {
        restApiName: "KavachPay API",

        description:
          "KavachPay Agentic Money Control Plane API",

        binaryMediaTypes: ["*/*"],

        deployOptions: {
          stageName: "dev",

          tracingEnabled: true,

          metricsEnabled: true,

          loggingLevel:
            apigateway.MethodLoggingLevel.INFO,
        },
      }
    );

    const lambdaIntegration =
      new apigateway.LambdaIntegration(
        this.kavachPayLambda,
        {
          proxy: true,
        }
      );

    // Express owns the routes.
    //
    // API Gateway simply forwards:
    //
    // /ready
    // /v0/grants
    // /v0/intents
    // /v0/exposure
    // /v0/decisions/*
    // /v0/webhooks/razorpay
    // /api/execute-order
    // etc.
    //
    this.api.root.addProxy({
      defaultIntegration:
        lambdaIntegration,

      anyMethod: true,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Outputs
    // ─────────────────────────────────────────────────────────────────────────

    new cdk.CfnOutput(
      this,
      "KavachPayLambdaName",
      {
        value:
          this.kavachPayLambda.functionName,

        description:
          "KavachPay backend Lambda function",
      }
    );

    new cdk.CfnOutput(
      this,
      "KavachPayApiUrl",
      {
        value:
          this.api.url,

        description:
          "KavachPay API Gateway URL",
      }
    );
  }
}
