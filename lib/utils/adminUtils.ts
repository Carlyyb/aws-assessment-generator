// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';
import { ADMIN_EMAILS, ADMIN_PERMISSIONS, DEFAULT_ADMIN_PERMISSION, AdminPermissionLevel } from '../config/adminConfig';

// 重新导出枚举，方便其他文件使用
export { AdminPermissionLevel } from '../config/adminConfig';

/**
 * 检查用户是否为管理员
 * @param userSub - 用户的 sub (ctx.identity.sub)
 * @param userEmail - 用户的邮箱 (从 Cognito 获取)
 * @returns boolean - 是否为管理员
 */
export function isAdmin(userSub: string, userEmail: string): boolean {
  if (!userSub || !userEmail) {
    return false;
  }
  
  // 确保邮箱比较时忽略大小写
  const normalizedEmail = userEmail.toLowerCase().trim();
  return ADMIN_EMAILS.includes(normalizedEmail);
}

/**
 * 获取管理员权限级别
 * @param userEmail - 用户邮箱
 * @returns AdminPermissionLevel - 管理员权限级别
 */
export function getAdminPermissionLevel(userEmail: string): AdminPermissionLevel | null {
  if (!userEmail) {
    return null;
  }
  
  const normalizedEmail = userEmail.toLowerCase().trim();
  
  // 首先检查是否是管理员
  if (!isAdmin('', normalizedEmail)) {
    return null;
  }
  
  return ADMIN_PERMISSIONS[normalizedEmail] || DEFAULT_ADMIN_PERMISSION;
}

/**
 * 检查管理员是否具有特定权限级别
 * @param userEmail - 用户邮箱
 * @param requiredLevel - 所需权限级别
 * @returns boolean - 是否具有所需权限
 */
export function hasAdminPermission(userEmail: string, requiredLevel: AdminPermissionLevel): boolean {
  const userLevel = getAdminPermissionLevel(userEmail);
  if (!userLevel) {
    return false;
  }
  
  // 权限级别优先级
  const levelPriority = {
    [AdminPermissionLevel.LOG_ADMIN]: 1,
    [AdminPermissionLevel.SYSTEM_ADMIN]: 2,
    [AdminPermissionLevel.SUPER_ADMIN]: 3,
  };
  
  return levelPriority[userLevel] >= levelPriority[requiredLevel];
}

/**
 * 在 GraphQL Resolver 中检查用户是否为管理员
 * 这个函数用于 AppSync resolver 中，使用 ctx.identity.sub
 * @param ctx - AppSync 上下文
 * @returns boolean - 是否为管理员
 */
export function isAdminFromContext(ctx: any): boolean {
  const userSub = ctx.identity?.sub;
  if (!userSub) {
    return false;
  }
  
  // 从 Cognito 用户池获取用户邮箱
  // 注意：这里需要在实际使用时，从 Cognito 用户池中获取用户的邮箱属性
  // 可以通过 Lambda resolver 或在前端获取用户信息后传递
  
  // 临时方案：从 ctx.identity 中获取邮箱（如果 Cognito 配置了返回邮箱）
  const userEmail = ctx.identity?.email || ctx.identity?.claims?.email;
  
  if (!userEmail) {
    return false;
  }
  
  return isAdmin(userSub, userEmail);
}

/**
 * 管理员权限检查装饰器函数
 * 在需要管理员权限的 resolver 开头调用此函数
 * @param ctx - AppSync 上下文
 * @param requiredLevel - 所需的权限级别（可选，默认为 SYSTEM_ADMIN）
 * @throws Error - 如果用户不是管理员或权限不足
 */
export function requireAdminPermission(ctx: any, requiredLevel: AdminPermissionLevel = AdminPermissionLevel.SYSTEM_ADMIN): void {
  const userSub = ctx.identity?.sub;
  const userEmail = ctx.identity?.claims?.email || ctx.identity?.username;
  
  if (!userSub) {
    util.error('用户未认证', 'Unauthorized');
  }
  
  if (!userEmail) {
    util.error('无法获取用户邮箱信息', 'Unauthorized');
  }
  
  if (!isAdmin(userSub, userEmail)) {
    util.error('需要管理员权限', 'Forbidden');
  }
  
  if (!hasAdminPermission(userEmail, requiredLevel)) {
    util.error(`需要 ${requiredLevel} 级别的管理员权限`, 'Forbidden');
  }
}

/**
 * 检查用户是否可以访问日志管理功能
 * @param ctx - AppSync 上下文
 * @returns boolean - 是否可以访问日志管理
 */
export function canAccessLogManagement(ctx: any): boolean {
  const userSub = ctx.identity?.sub;
  const userEmail = ctx.identity?.claims?.email || ctx.identity?.username;
  
  console.log('检查日志管理权限:', {
    userSub,
    userEmail,
    normalizedEmail: userEmail?.toLowerCase()?.trim(),
    adminEmails: ADMIN_EMAILS,
    isAdmin: isAdmin(userSub, userEmail)
  });
  
  if (!userSub || !userEmail) {
    console.log('权限检查失败: 缺少用户信息');
    return false;
  }
  
  // 直接检查是否是管理员（任何级别的管理员都可以访问日志）
  const adminStatus = isAdmin(userSub, userEmail);
  console.log('用户管理员状态:', adminStatus);
  
  return adminStatus;
}

/**
 * 获取用户角色信息（包括管理员状态）
 * @param ctx - AppSync 上下文
 * @returns 用户角色信息
 */
export function getUserRoleInfo(ctx: any): {
  userId: string;
  email: string;
  group: string;
  isAdmin: boolean;
  adminLevel?: AdminPermissionLevel;
} {
  const userSub = ctx.identity?.sub;
  const userEmail = ctx.identity?.claims?.email || ctx.identity?.username;
  const userGroup = ctx.identity?.groups?.[0] || 'unknown';
  
  const adminStatus = isAdmin(userSub, userEmail);
  const adminLevel = adminStatus ? getAdminPermissionLevel(userEmail) : undefined;
  
  return {
    userId: userSub,
    email: userEmail,
    group: userGroup,
    isAdmin: adminStatus,
    adminLevel,
  };
}
