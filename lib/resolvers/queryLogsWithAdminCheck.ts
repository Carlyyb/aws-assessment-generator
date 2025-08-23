// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';
import { requireAdminPermission, canAccessLogManagement } from '../utils/adminUtils';
import { AdminPermissionLevel } from '../config/adminConfig';

/**
 * 日志查询的管理员权限检查 resolver
 * 确保只有具有日志管理权限的管理员才能访问日志功能
 */
export function request(ctx) {
  // 检查用户是否有日志管理权限
  if (!canAccessLogManagement(ctx)) {
    util.error('访问日志管理功能需要管理员权限', 'Forbidden');
  }
  
  // 或者使用更严格的权限检查
  // requireAdminPermission(ctx, AdminPermissionLevel.LOG_ADMIN);
  
  // 将请求转发给实际的日志查询 Lambda
  return {
    operation: 'Invoke',
    payload: {
      operation: ctx.args.input.operation,
      filters: ctx.args.input.filters,
      searchQuery: ctx.args.input.searchQuery,
      // 添加用户信息用于审计
      requesterInfo: {
        userId: ctx.identity.sub,
        email: ctx.identity.claims?.email || ctx.identity.username,
        timestamp: new Date().toISOString()
      }
    }
  };
}

export const response = (ctx) => {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  
  // 记录管理员访问日志
  console.log('Admin log access:', {
    userId: ctx.identity.sub,
    operation: ctx.result.operation,
    timestamp: new Date().toISOString()
  });
  
  return ctx.result;
};
