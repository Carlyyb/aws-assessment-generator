// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';
import { isAdminFromContext, getUserRoleInfo } from '../utils/adminUtils';

export function request(ctx) {
  const { items } = ctx.args; // 修改为接受包含userId的items数组
  const userInfo = getUserRoleInfo(ctx);
  
  if (!items || items.length === 0) {
    util.error('No template items provided', 'InvalidInput');
  }
  
  // 检查权限并准备删除操作
  const deleteRequests = [];
  
  for (const item of items) {
    const { id, userId } = item;
    
    // 权限检查
    if (!userInfo.isAdmin && userId !== ctx.identity.sub) {
      util.error(`Permission denied for template ${id}`, 'Unauthorized');
    }
    
    deleteRequests.push({
      operation: 'DeleteItem',
      key: util.dynamodb.toMapValues({ userId, id })
    });
  }
  
  // 返回第一个删除请求，其他的在response中处理
  ctx.stash.deleteRequests = deleteRequests;
  ctx.stash.currentIndex = 0;
  ctx.stash.results = [];
  
  return deleteRequests[0];
}

export const response = (ctx) => {
  const deleteRequests = ctx.stash.deleteRequests;
  const currentIndex = ctx.stash.currentIndex;
  const results = ctx.stash.results || [];
  
  // 记录当前操作结果
  if (ctx.error) {
    results.push({ success: false, error: ctx.error.message });
  } else {
    results.push({ success: true });
  }
  
  // 检查是否还有更多删除操作
  const nextIndex = currentIndex + 1;
  if (nextIndex < deleteRequests.length) {
    // 继续下一个删除
    ctx.stash.currentIndex = nextIndex;
    ctx.stash.results = results;
    return deleteRequests[nextIndex];
  }
  
  // 所有操作完成
  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;
  
  return {
    success: failedCount === 0,
    deletedCount: successCount,
    failedCount: failedCount
  };
};
