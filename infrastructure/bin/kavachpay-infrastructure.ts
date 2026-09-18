#!/usr/bin/env node

import * as cdk from "aws-cdk-lib";
import { KavachPayStack } from "../lib/kavachpay-stack";

const app = new cdk.App();

new KavachPayStack(app, "KavachPayStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || "985539777421",
    region: process.env.CDK_DEFAULT_REGION || "ap-south-1",
  },
  description: "KavachPay Agentic Money Control Plane infrastructure",
});
