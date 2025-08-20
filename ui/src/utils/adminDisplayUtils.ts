// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 用户角色显示工具（简化版本）
 */

import { UserRole } from './adminPermissions';
import { getText } from '../i18n/lang';

/**
 * 获取用户角色的中文显示名称
 */
export function getUserRoleDisplayName(role?: UserRole): string {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return getText('common.role.super_admin') || '超级管理员';
    case UserRole.ADMIN:
      return getText('common.role.admin') || '管理员';
    case UserRole.TEACHER:
      return getText('common.role.teachers') || '教师';
    case UserRole.STUDENT:
      return getText('common.role.students') || '学生';
    default:
      return '';
  }
}

/**
 * 获取用户角色的英文显示名称
 */
export function getUserRoleDisplayNameEn(role?: UserRole): string {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return 'Super Admin';
    case UserRole.ADMIN:
      return 'Admin';
    case UserRole.TEACHER:
      return 'Teacher';
    case UserRole.STUDENT:
      return 'Student';
    default:
      return '';
  }
}

/**
 * 根据当前语言获取用户角色显示名称
 */
export function getUserRoleDisplayNameLocalized(role?: UserRole, locale: string = 'zh'): string {
  return locale === 'zh' ? getUserRoleDisplayName(role) : getUserRoleDisplayNameEn(role);
}

// 为了向后兼容，保留旧的函数名
export const getAdminLevelDisplayName = getUserRoleDisplayName;
export const getAdminLevelDisplayNameEn = getUserRoleDisplayNameEn;
export const getAdminLevelDisplayNameLocalized = getUserRoleDisplayNameLocalized;
