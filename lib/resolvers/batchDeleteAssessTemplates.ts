// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';
import { isAdminFromContext, getUserRoleInfo } from '../utils/adminUtils';

export function request(ctx) {
  const { ids } = ctx.args;
  const userInfo = getUserRoleInfo(ctx);
  
  if (!ids || ids.length === 0) {
    util.error('No template IDs provided', 'InvalidInput');
  }
  
  // 将id列表存储在stash中，方便response函数使用
  ctx.stash.idsToDelete = ids;
  ctx.stash.userInfo = userInfo;
  ctx.stash.deleteResults = [];
  ctx.stash.currentIndex = 0;
  
  // 开始第一个删除操作
  const firstId = ids[0];
  if (userInfo.isAdmin) {
    return {
      operation: 'DeleteItem',
      key: util.dynamodb.toMapValues({ id: firstId })
    };
  } else {
    return {
      operation: 'DeleteItem',
      key: util.dynamodb.toMapValues({ id: firstId }),
      condition: {
        expression: 'userId = :userId',
        expressionValues: util.dynamodb.toMapValues({ ':userId': ctx.identity.sub })
      }
    };
  }
}

export const response = (ctx) => {
  const idsToDelete = ctx.stash.idsToDelete;
  const currentIndex = ctx.stash.currentIndex;
  const deleteResults = ctx.stash.deleteResults || [];
  
  // 记录当前删除结果
  if (ctx.error) {
    deleteResults.push({ success: false, id: idsToDelete[currentIndex] });
  } else {
    deleteResults.push({ success: true, id: idsToDelete[currentIndex] });
  }
  
  // 检查是否还有更多项目需要删除
  const nextIndex = currentIndex + 1;
  if (nextIndex < idsToDelete.length) {
    // 继续下一个删除操作
    ctx.stash.deleteResults = deleteResults;
    ctx.stash.currentIndex = nextIndex;
    
    const nextId = idsToDelete[nextIndex];
    const userInfo = ctx.stash.userInfo;
    
    if (userInfo.isAdmin) {
      return util.dynamodb.delete({
        key: { id: nextId }
      });
    } else {
      return util.dynamodb.delete({
        key: { id: nextId },
        condition: util.dynamodb.attribute('userId').eq(ctx.identity.sub)
      });
    }
  }
  
  // 所有删除操作完成，返回最终结果
  const successCount = deleteResults.filter(r => r.success).length;
  const failedCount = deleteResults.filter(r => !r.success).length;
  
  return {
    success: failedCount === 0,
    deletedCount: successCount,
    failedCount: failedCount,
    message: failedCount === 0 ? 'All templates deleted successfully' : `${failedCount} templates failed to delete`
  };
};
