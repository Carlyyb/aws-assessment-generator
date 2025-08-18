// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { id } = ctx.args;
  const userId = ctx.identity.sub;
  
  // 检查管理员权限
  const adminGroups = ['super_admin', 'system_admin'];
  const userGroups = ctx.identity?.claims?.['cognito:groups'] || [];
  const isAdmin = adminGroups.some(group => userGroups.includes(group));
  
  // 如果不是管理员，只允许删除自己的测试
  if (!isAdmin) {
    // 简单权限检查：只允许删除自己的测试
    if (userId !== ctx.identity.sub) {
      util.error('Permission denied', 'Unauthorized');
    }
  }
  
  // 调用 Lambda 函数进行级联删除
  return {
    operation: 'Invoke',
    payload: {
      field: 'deleteAssessment',
      arguments: {
        id,
        userId,
        isAdmin
      },
      identity: ctx.identity
    }
  };
}

export const response = (ctx) => {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  
  return ctx.result.success || false;
};
