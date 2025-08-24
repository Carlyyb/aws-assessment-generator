// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';

/**
 * AppSync Resolver: updateUserActivity
 * 更新用户活跃状态，用于在线状态跟踪
 */
export function request(ctx) {
  const { username, role } = ctx.arguments;
  
  console.log('updateUserActivity request:', { username, role });
  
  // 构建 Lambda 调用载荷
  return {
    operation: 'Invoke',
    payload: {
      operation: 'updateUserActivity',
      arguments: ctx.arguments,
      identity: ctx.identity
    }
  };
}

export function response(ctx) {
  console.log('updateUserActivity response:', ctx.result);
  
  if (ctx.error) {
    console.error('updateUserActivity error:', ctx.error);
    util.error(ctx.error.message || '更新用户活跃状态失败', 'ACTIVITY_UPDATE_ERROR');
  }
  
  return ctx.result;
}
