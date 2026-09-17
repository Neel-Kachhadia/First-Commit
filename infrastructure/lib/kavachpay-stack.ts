import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export class KavachPayStack extends cdk.Stack {
  public readonly kavachPayTable: dynamodb.Table;

  constructor(
    scope: Construct,
    id: string,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

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

      pointInTimeRecovery: true,

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
  }
}
