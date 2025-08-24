// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as ddb from '@aws-appsync/utils/dynamodb';
import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const input = ctx.args.input;
  
  // 验证输入
  if (!input.logoUrl || !input.uploadedBy) {
    util.error("logoUrl and uploadedBy are required", "ValidationError");
  }
  
  const item = {
    id: "global", // 固定的ID
    logoUrl: input.logoUrl,
    uploadedBy: input.uploadedBy,
    uploadedAt: util.time.nowISO8601()
  };
  
  return ddb.put({ key: { id: "global" }, item });
}

export const response = (ctx) => {
  return ctx.result;
};
