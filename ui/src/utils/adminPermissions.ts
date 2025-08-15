// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 前端管理员权限检查工具
 * 
 * 使用说明：
 * 1. 在前端组件中导入此文件
 * 2. 调用 checkIfUserIsAdmin 函数来检查当前用户是否为管理员
 * 3. 使用返回的权限信息来控制UI显示和功能访问
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
 * 管理员邮箱配置（前端版本 - 仅用于快速检查）
 * 注意：这只是为了快速UI反馈，真正的权限验证在后端进行
 */
const ADMIN_EMAILS: string[] = [
  'yibo.yan24@student.xjtlu.edu.cn',
  // 添加更多管理员邮箱
];

/**
 * 快速检查邮箱是否在管理员列表中（前端快速验证）
 * @param email 用户邮箱
 * @returns 是否可能是管理员
 */
export function isEmailAdmin(email: string): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/**
 * 从 Cognito 用户信息中检查是否为管理员
 * @param user Amplify Auth 用户对象
 * @returns 是否可能是管理员（基于邮箱）
 */
export function isUserPotentialAdmin(user: any): boolean {
  const email = user?.attributes?.email || user?.email;
  return isEmailAdmin(email);
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
 * 简化的管理员检查函数（基于邮箱的快速检查）
 * @param userEmail 用户邮箱
 * @returns 是否为管理员
 */
export function isAdminByEmail(userEmail: string): boolean {
  return isEmailAdmin(userEmail);
}

/**
 * 权限检查工具函数集合
 */
export const AdminUtils = {
  isEmailAdmin,
  isUserPotentialAdmin,
  checkUserAdminPermissions,
  useAdminPermissions,
  checkPermissionLevel,
  isAdminByEmail,
};
