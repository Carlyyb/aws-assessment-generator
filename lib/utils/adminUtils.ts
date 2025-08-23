// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';
import { UserRole, hasAdminPermission as hasAdminPermissionFromConfig, hasSuperAdminPermission } from '../config/adminConfig';

// 重新导出枚举，方便其他文件使用
export { UserRole } from '../config/adminConfig';

/**
 * 从Cognito用户组检查是否为管理员
 * @param userGroups - 用户的Cognito groups数组
 * @returns boolean - 是否为管理员
 */
export function isAdmin(userGroups: string[]): boolean {
  if (!userGroups || !Array.isArray(userGroups)) {
    return false;
  }
  
  return hasAdminPermissionFromConfig(userGroups);
}

/**
 * 获取用户最高权限角色
 * @param userGroups - 用户的Cognito groups数组
 * @returns UserRole - 用户角色
 */
export function getUserHighestRole(userGroups: string[]): UserRole {
  if (!userGroups || !Array.isArray(userGroups)) {
    return UserRole.STUDENT;
  }
  
  if (userGroups.includes(UserRole.SUPER_ADMIN)) return UserRole.SUPER_ADMIN;
  if (userGroups.includes(UserRole.ADMIN)) return UserRole.ADMIN;
  if (userGroups.includes(UserRole.TEACHER)) return UserRole.TEACHER;
  return UserRole.STUDENT;
}

/**
 * 检查是否为超级管理员
 * @param userGroups - 用户的Cognito groups数组
 * @returns boolean - 是否为超级管理员
 */
export function isSuperAdmin(userGroups: string[]): boolean {
  if (!userGroups || !Array.isArray(userGroups)) {
    return false;
  }
  
  return hasSuperAdminPermission(userGroups);
}

/**
 * 检查是否具有特定权限
 * @param userGroups - 用户的Cognito groups数组
 * @param requiredRole - 所需的最低角色
 * @returns boolean - 是否具有权限
 */
export function hasPermission(userGroups: string[], requiredRole: UserRole): boolean {
  if (!userGroups || !Array.isArray(userGroups)) {
    return false;
  }
  
  const userRole = getUserHighestRole(userGroups);
  const roleHierarchy = [UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN];
  
  const userLevel = roleHierarchy.indexOf(userRole);
  const requiredLevel = roleHierarchy.indexOf(requiredRole);
  
  return userLevel >= requiredLevel;
}

/**
 * 从 AppSync 上下文获取用户组信息
 * @param context - AppSync context
 * @returns string[] - 用户组数组
 */
export function getUserGroupsFromContext(context: any): string[] {
  try {
    // 从Cognito Identity context中获取groups
    if (context.identity && context.identity.groups) {
      return Array.isArray(context.identity.groups) ? context.identity.groups : [];
    }
    
    // 如果没有groups字段，检查是否有其他形式的组信息
    if (context.identity && context.identity.claims && context.identity.claims['cognito:groups']) {
      const groups = context.identity.claims['cognito:groups'];
      return Array.isArray(groups) ? groups : [];
    }
    
    return [];
  } catch (error) {
    console.error('Error extracting user groups from context:', error);
    return [];
  }
}

/**
 * 从 AppSync 上下文检查是否为管理员
 * @param context - AppSync context
 * @returns boolean - 是否为管理员
 */
export function isAdminFromContext(context: any): boolean {
  const userGroups = getUserGroupsFromContext(context);
  return isAdmin(userGroups);
}

/**
 * 获取用户角色信息（向后兼容接口）
 */
export function getUserRoleInfo(context: any) {
  const userGroups = getUserGroupsFromContext(context);
  const highestRole = getUserHighestRole(userGroups);
  
  return {
    isAdmin: isAdmin(userGroups),
    isSuperAdmin: isSuperAdmin(userGroups),
    userRole: highestRole,
    groups: userGroups,
    email: context.identity?.claims?.email || '',
    userId: context.identity?.sub || '',
    permissions: {
      canAccessLogManagement: isSuperAdmin(userGroups),
      canManageUsers: isAdmin(userGroups),
      canManageSystem: isAdmin(userGroups),
      canCreateAdmin: isSuperAdmin(userGroups),
      canUploadLogo: isAdmin(userGroups),
    }
  };
}

/**
 * 向后兼容的权限检查函数
 * @param userEmail - 用户邮箱 (已废弃，现在使用用户组)
 * @param requiredRole - 所需角色
 * @returns boolean
 */
export function hasAdminPermission(userEmail: string, requiredRole: UserRole): boolean {
  // 这是向后兼容函数，实际应该使用context获取用户组
  console.warn('hasAdminPermission with email is deprecated, use hasPermission with user groups instead');
  return false;
}
