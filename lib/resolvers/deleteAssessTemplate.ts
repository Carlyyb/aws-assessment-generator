// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { id, userId } = ctx.args;
  
  // 权限检查：只允许删除自己的模板，管理员可以删除所有模板
  const userGroups = ctx.identity.groups || [];
  const isAdmin = userGroups.includes('admin') || userGroups.includes('super_admin');
  
  if (!isAdmin && userId !== ctx.identity.sub) {
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
