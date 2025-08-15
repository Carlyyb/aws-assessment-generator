// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 管理员权限级别显示工具
 */

import { AdminPermissionLevel } from './adminPermissions';
import { getText } from '../i18n/lang';

/**
 * 获取管理员权限级别的中文显示名称
 */
export function getAdminLevelDisplayName(level?: AdminPermissionLevel): string {
  switch (level) {
    case AdminPermissionLevel.SUPER_ADMIN:
      return getText('common.admin.super_admin') || '超级管理员';
    case AdminPermissionLevel.SYSTEM_ADMIN:
      return getText('common.admin.system_admin') || '系统管理员';
    case AdminPermissionLevel.LOG_ADMIN:
      return getText('common.admin.log_admin') || '日志管理员';
    default:
      return '';
  }
}

/**
 * 获取管理员权限级别的英文显示名称
 */
export function getAdminLevelDisplayNameEn(level?: AdminPermissionLevel): string {
  switch (level) {
    case AdminPermissionLevel.SUPER_ADMIN:
      return 'Super Admin';
    case AdminPermissionLevel.SYSTEM_ADMIN:
      return 'System Admin';
    case AdminPermissionLevel.LOG_ADMIN:
      return 'Log Admin';
    default:
      return '';
  }
}

/**
 * 根据当前语言获取管理员权限级别显示名称
 */
export function getAdminLevelDisplayNameLocalized(level?: AdminPermissionLevel, locale: string = 'zh'): string {
  return locale === 'zh' ? getAdminLevelDisplayName(level) : getAdminLevelDisplayNameEn(level);
}
