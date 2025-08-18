// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
// import { Context } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const userId = ctx.identity.sub;
  return ddb.get({ key: { userId } });
}

export const response = (ctx) => {
  const result = ctx.result;
  
  // 如果 uiLang 为 null 值则设为 "zh"
  if (result && result.uiLang === null) {
    result.uiLang = "zh";
  }
  
  return result;
};
