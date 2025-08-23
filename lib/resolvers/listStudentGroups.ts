// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  // 调用 Lambda 函数处理分组列表查询逻辑
  return {
    operation: 'Invoke',
    payload: {
      operation: 'listStudentGroups',
      arguments: ctx.arguments,
      identity: ctx.identity
    }
  };
}

export const response = (ctx) => {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
};
