// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 前端管理员权限检查工具
 * 
 * 基于Cognito用户组的权限系统：
 * - 学生 (students): 参与测试，查看测试结果
 * - 教师 (teachers): 创建课程、管理知识库、设置测试
 * - 管理员 (admin): 访问所有教师和学生功能，上传Logo，创建/删除用户
 * - 超级管理员 (super_admin): 所有功能 + 创建管理员账号 + 日志访问 + 权限控制
 * 
 * 权限检查现在基于JWT token中的cognito:groups字段，而不是硬编码的邮箱列表
 */

import React from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';

/**
 * 简化的用户角色枚举（前端版本）
 */
export enum UserRole {
  STUDENT = 'students',         // 学生
  TEACHER = 'teachers',         // 教师  
  ADMIN = 'admin',             // 管理员
  SUPER_ADMIN = 'super_admin'   // 超级管理员
}

/**
 * JWT Token payload 接口
 */
interface CognitoTokenPayload {
  sub: string;
  email?: string;
  'cognito:username'?: string;
  'cognito:groups'?: string[];
  [key: string]: unknown;
}

/**
 * 管理员权限信息接口
 */
export interface AdminPermissionInfo {
  userId: string;
  email?: string;
  username?: string;
  groups: string[];
  highestRole: UserRole;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  permissions: {
    canManageUsers: boolean;
    canManageSystem: boolean;
    canCreateAdmin: boolean;
    canUploadLogo: boolean;
    canCreateCourse: boolean;
    canManageKnowledgeBase: boolean;
    canSetAssessment: boolean;
  };
}

/**
 * 从用户组数组中获取最高权限级别
 */
function getUserHighestRole(groups: string[]): UserRole {
  if (groups.includes(UserRole.SUPER_ADMIN)) return UserRole.SUPER_ADMIN;
  if (groups.includes(UserRole.ADMIN)) return UserRole.ADMIN;
  if (groups.includes(UserRole.TEACHER)) return UserRole.TEACHER;
  return UserRole.STUDENT;
}

/**
 * 检查用户组是否具有管理员权限
 */
function hasAdminPermissionFromGroups(groups: string[]): boolean {
  return groups.includes(UserRole.ADMIN) || groups.includes(UserRole.SUPER_ADMIN);
}

/**
 * 检查用户组是否具有超级管理员权限
 */
function hasSuperAdminPermissionFromGroups(groups: string[]): boolean {
  return groups.includes(UserRole.SUPER_ADMIN);
}

/**
 * 检查用户组是否具有教师权限
 */
function hasTeacherPermissionFromGroups(groups: string[]): boolean {
  return groups.includes(UserRole.TEACHER) || 
         groups.includes(UserRole.ADMIN) || 
         groups.includes(UserRole.SUPER_ADMIN);
}

/**
 * 检查用户组是否具有学生权限
 */
function hasStudentPermissionFromGroups(groups: string[]): boolean {
  return groups.includes(UserRole.STUDENT) || 
         groups.includes(UserRole.TEACHER) || 
         groups.includes(UserRole.ADMIN) || 
         groups.includes(UserRole.SUPER_ADMIN);
}

/**
 * 根据用户组获取详细权限配置
 */
function getPermissionsFromGroups(groups: string[]) {
  const isAdmin = hasAdminPermissionFromGroups(groups);
  const isSuperAdmin = hasSuperAdminPermissionFromGroups(groups);
  const isTeacher = hasTeacherPermissionFromGroups(groups);

  return {
    canManageUsers: isAdmin,
    canManageSystem: isAdmin,
    canCreateAdmin: isSuperAdmin,
    canUploadLogo: isAdmin,
    canCreateCourse: isTeacher,
    canManageKnowledgeBase: isTeacher,
    canSetAssessment: isTeacher,
  };
}

/**
 * 从JWT token中解析用户组信息
 */
function getUserGroupsFromToken(decodedToken: CognitoTokenPayload): string[] {
  try {
    // Cognito在ID token中以 'cognito:groups' 字段存储用户组
    const groups = decodedToken['cognito:groups'] || [];
    return Array.isArray(groups) ? groups : [];
  } catch (error) {
    console.error('Error parsing user groups from token:', error);
    return [];
  }
}

/**
 * 获取当前用户的权限信息
 * @returns Promise<AdminPermissionInfo | null>
 */
export async function checkUserAdminPermissions(): Promise<AdminPermissionInfo | null> {
  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken;
    
    if (!idToken) {
      console.warn('No ID token found in session');
      return null;
    }

    const payload = idToken.payload as CognitoTokenPayload;
    const groups = getUserGroupsFromToken(payload);
    const highestRole = getUserHighestRole(groups);
    
    return {
      userId: payload.sub,
      email: payload.email,
      username: payload['cognito:username'],
      groups: groups,
      highestRole: highestRole,
      isAdmin: hasAdminPermissionFromGroups(groups),
      isSuperAdmin: hasSuperAdminPermissionFromGroups(groups),
      isTeacher: hasTeacherPermissionFromGroups(groups),
      isStudent: hasStudentPermissionFromGroups(groups),
      permissions: getPermissionsFromGroups(groups)
    };
  } catch (error) {
    console.error('检查用户权限时出错:', error);
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
 * 检查用户角色是否具有管理员权限
 */
export function hasAdminPermission(userRole?: UserRole): boolean {
  return userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN;
}

/**
 * 检查用户角色是否具有超级管理员权限
 */
export function hasSuperAdminPermission(userRole?: UserRole): boolean {
  return userRole === UserRole.SUPER_ADMIN;
}

/**
 * 根据用户角色获取权限配置（向后兼容接口）
 */
export function getPermissions(userRole: UserRole) {
  return {
    canManageUsers: hasAdminPermission(userRole),
    canManageSystem: hasAdminPermission(userRole),
    canCreateAdmin: userRole === UserRole.SUPER_ADMIN,
    canUploadLogo: hasAdminPermission(userRole),
  };
}

/**
 * 权限检查工具函数集合
 */
export const AdminUtils = {
  checkUserAdminPermissions,
  useAdminPermissions,
  hasAdminPermission,
  hasSuperAdminPermission,
  getPermissions,
};
