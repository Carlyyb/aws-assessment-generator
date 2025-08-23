#!/usr/bin/env node

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as os from 'os';
import { CfnGuardValidator } from '@cdklabs/cdk-validator-cfnguard';
import { GenAssessStack } from '../lib/gen-assess-stack';

// 只在支持的平台上启用CfnGuardValidator
const policyValidation = os.platform() === 'win32' 
  ? [] 
  : [new CfnGuardValidator({
      disabledRules: ['ct-lambda-pr-3'],
    })];

const app = new cdk.App({
  policyValidationBeta1: policyValidation,
});

new GenAssessStack(app, 'GenAssessStack', { description: 'Assessment Generator (uksb-buf2grwawv)' });
