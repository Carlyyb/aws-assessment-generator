// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';
import { isAdminFromContext, getUserRoleInfo, hasAdminPermission } from '../utils/adminUtils';
import { AdminPermissionLevel } from '../config/adminConfig';

/**
 * 检查用户管理员权限的 resolver
 * 用于前端验证用户是否具有管理员权限
 */
export function request(ctx) {
  const userInfo = getUserRoleInfo(ctx);
  
  // 返回用户角色信息，不需要查询数据库
  return {
    operation: 'GetItem',
    key: {
      id: util.dynamodb.toDynamoDB(userInfo.userId)
    }
  };
}

export const response = (ctx) => {
  const userInfo = getUserRoleInfo(ctx);
  
  // 返回管理员权限信息
  return {
    userId: userInfo.userId,
    email: userInfo.email,
    group: userInfo.group,
    isAdmin: userInfo.isAdmin,
    adminLevel: userInfo.adminLevel,
    permissions: {
      canAccessLogManagement: userInfo.isAdmin && hasAdminPermission(userInfo.email, AdminPermissionLevel.LOG_ADMIN),
      canManageUsers: userInfo.isAdmin && hasAdminPermission(userInfo.email, AdminPermissionLevel.SYSTEM_ADMIN),
      canManageSystem: userInfo.isAdmin && hasAdminPermission(userInfo.email, AdminPermissionLevel.SUPER_ADMIN),
    }
  };
};
