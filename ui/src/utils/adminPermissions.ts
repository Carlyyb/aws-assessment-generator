// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 前端管理员权限检查工具
 * 
 * 使用说明：
 * 1. 在前端组件中导入此文件
 * 2. 调用 checkUserAdminPermissions 函数来检查当前用户是否为管理员
 * 3. 使用返回的权限信息来控制UI显示和功能访问
 * 4. 所有权限验证都基于后端配置，确保安全性
 * 
 * 注意：此文件不包含任何前端权限配置，所有权限检查都通过后端进行
 */

import React from 'react';
import { generateClient } from 'aws-amplify/api';

const client = generateClient();

/**
 * 管理员权限级别枚举（前端版本）
 */
export enum AdminPermissionLevel {
  SUPER_ADMIN = 'super_admin',     // 超级管理员 - 完全权限
  SYSTEM_ADMIN = 'system_admin',   // 系统管理员 - 系统管理权限
  LOG_ADMIN = 'log_admin',         // 日志管理员 - 仅日志查看权限
}

/**
 * 管理员权限信息接口
 */
export interface AdminPermissionInfo {
  userId: string;
  email: string;
  group: string;
  isAdmin: boolean;
  adminLevel?: AdminPermissionLevel;
  permissions: {
    canAccessLogManagement: boolean;
    canManageUsers: boolean;
    canManageSystem: boolean;
  };
}

/**
 * GraphQL 查询字符串（临时定义）
 */
const CHECK_ADMIN_PERMISSIONS = `
  query CheckAdminPermissions {
    checkAdminPermissions {
      userId
      email
      group
      isAdmin
      adminLevel
      permissions {
        canAccessLogManagement
        canManageUsers
        canManageSystem
      }
    }
  }
`;

/**
 * 向后端查询用户的完整管理员权限信息
 * @returns Promise<AdminPermissionInfo | null>
 */
export async function checkUserAdminPermissions(): Promise<AdminPermissionInfo | null> {
  try {
    const result = await client.graphql({
      query: CHECK_ADMIN_PERMISSIONS,
    });
    console.log(result);
    // 类型安全的方式访问数据
    if ('data' in result && result.data) {
      return result.data.checkAdminPermissions as AdminPermissionInfo;
    }
    
    return null;
  } catch (error) {
    console.error('检查管理员权限时出错:', error);
    return null;
  }
}

/**
 * React Hook: 获取管理员权限信息
 * 使用示例：
 * ```
 * const { adminInfo, loading, error } = useAdminPermissions();
 * if (adminInfo?.isAdmin) {
 *   // 显示管理员功能
 * }
 * ```
 */
export function useAdminPermissions() {
  const [adminInfo, setAdminInfo] = React.useState<AdminPermissionInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    checkUserAdminPermissions()
      .then(setAdminInfo)
      .catch((err) => {
        setError(err.message);
        setAdminInfo(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return { adminInfo, loading, error };
}

/**
 * 检查权限级别是否足够
 */
function checkPermissionLevel(userLevel?: AdminPermissionLevel, requiredLevel: AdminPermissionLevel = AdminPermissionLevel.SYSTEM_ADMIN): boolean {
  if (!userLevel) return false;

  const levelPriority = {
    [AdminPermissionLevel.LOG_ADMIN]: 1,
    [AdminPermissionLevel.SYSTEM_ADMIN]: 2,
    [AdminPermissionLevel.SUPER_ADMIN]: 3,
  };

  return levelPriority[userLevel] >= levelPriority[requiredLevel];
}

/**
 * 权限检查工具函数集合
 */
export const AdminUtils = {
  checkUserAdminPermissions,
  useAdminPermissions,
  checkPermissionLevel,
};
