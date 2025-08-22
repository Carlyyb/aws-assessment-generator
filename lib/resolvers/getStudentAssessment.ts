// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const userId = ctx.identity.sub;
  return ddb.get({ key: { userId, parentAssessId: ctx.args.parentAssessId } });
}

export function response(ctx) {
  // 直接返回 DynamoDB 的原始结果，让后续的 Lambda 函数进行转换
  return ctx.result;
}
