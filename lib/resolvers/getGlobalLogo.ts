// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  // 使用固定的key "global" 来查询全局Logo
  return ddb.get({ key: { id: "global" } });
}

export const response = (ctx) => {
  const result = ctx.result;
  
  if (!result) {
    // 如果没有Logo记录，返回null
    return null;
  }
  
  return result;
};
