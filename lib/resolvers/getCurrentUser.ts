// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 获取当前用户信息解析器
 * 调用Lambda函数处理复杂逻辑
 */

import { util } from '@aws-appsync/utils';

/**
 * 请求映射
 */
export function request(ctx) {
  return {
    operation: 'Invoke',
    payload: {
      identity: ctx.identity,
      source: ctx.source,
      arguments: ctx.arguments
    }
  };
}

/**
 * 响应映射
 */
export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  
  return ctx.result;
}