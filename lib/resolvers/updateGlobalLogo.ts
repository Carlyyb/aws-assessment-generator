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
  
  const updateValues = {
    logoUrl: input.logoUrl,
    uploadedBy: input.uploadedBy,
    uploadedAt: util.time.nowISO8601()
  };
  
  return ddb.update({ 
    key: { id: "global" }, 
    update: updateValues 
  });
}

export const response = (ctx) => {
  return ctx.result;
};
