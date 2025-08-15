// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { id, userId } = ctx.args;
  
  // 简单权限检查：只允许删除自己的模板
  // TODO: 稍后添加管理员权限支持
  if (userId !== ctx.identity.sub) {
    util.error('Permission denied', 'Unauthorized');
  }
  
  return {
    operation: 'DeleteItem',
    key: util.dynamodb.toMapValues({ userId, id })
  };
}

export const response = (ctx) => {
  if (ctx.error) {
    return false;
  }
  return true;
};
