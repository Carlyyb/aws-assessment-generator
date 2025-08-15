// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 管理员配置文件
 * 
 * 在这里配置具有管理员权限的用户邮箱
 * 这些用户将拥有系统管理员权限，可以：
 * - 访问日志管理
 * - 管理所有用户数据
 * - 执行系统级操作
 */

export const ADMIN_EMAILS: string[] = [
  // 在这里添加管理员邮箱
  'yibo.yan24@student.xjtlu.edu.cn',
];

/**
 * 管理员权限级别
 */
export enum AdminPermissionLevel {
  SUPER_ADMIN = 'super_admin',     // 超级管理员 - 完全权限
  SYSTEM_ADMIN = 'system_admin',   // 系统管理员 - 系统管理权限
  LOG_ADMIN = 'log_admin',         // 日志管理员 - 仅日志查看权限
}

/**
 * 管理员权限配置
 * 可以为不同的管理员配置不同的权限级别
 */
export const ADMIN_PERMISSIONS: Record<string, AdminPermissionLevel> = {
  'admin@example.com': AdminPermissionLevel.SUPER_ADMIN,
  'system.admin@company.com': AdminPermissionLevel.SYSTEM_ADMIN,
  // 'log.viewer@company.com': AdminPermissionLevel.LOG_ADMIN,
};

/**
 * 默认管理员权限级别
 * 如果邮箱在 ADMIN_EMAILS 中但未在 ADMIN_PERMISSIONS 中指定，使用此默认级别
 */
export const DEFAULT_ADMIN_PERMISSION = AdminPermissionLevel.SYSTEM_ADMIN;
