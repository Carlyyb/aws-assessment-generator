// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 管理员配置文件
 * 
 * 简化的用户分级系统：
 * - 学生 (students): 参与测试，查看测试结果
 * - 教师 (teachers): 创建课程、管理知识库、设置测试
 * - 管理员 (admin): 访问所有教师和学生功能，上传Logo，创建/删除用户
 * - 超级管理员 (super_admin): 所有功能 + 创建管理员账号 + 日志访问 + 权限控制
 * 
 * 权限检查现在使用Cognito用户组，而不是硬编码的邮箱列表
 */

/**
 * 简化的用户角色枚举
 * 这些角色与Cognito用户组名称一致
 */
export enum UserRole {
  STUDENT = 'students',         // 学生 - 参与测试，查看测试结果
  TEACHER = 'teachers',         // 教师 - 创建课程、管理知识库、设置测试
  ADMIN = 'admin',             // 管理员 - 所有教师功能 + 用户管理 + Logo上传
  SUPER_ADMIN = 'super_admin'   // 超级管理员 - 所有功能 + 创建管理员 + 日志访问
}

/**
 * 超级管理员初始化配置
 * 用于在系统首次部署时创建超级管理员账号
 * 生产环境建议使用环境变量或AWS Secrets Manager
 */
export const SUPER_ADMIN_CONFIG = {
  // 默认超级管理员账号，生产环境应该通过环境变量设置
  username: process.env.SUPER_ADMIN_USERNAME || 'superadmin',
  // 默认邮箱，用于登录和密码找回
  email: process.env.SUPER_ADMIN_EMAIL || 'yibo.yan24@student.xjtlu.edu.cn',
  // 默认密码，首次登录后会强制修改
  defaultPassword: process.env.SUPER_ADMIN_DEFAULT_PASSWORD || 'SuperAdmin@2024!',
  // 姓名
  name: process.env.SUPER_ADMIN_NAME || '系统管理员'
};

/**
 * 基于Cognito用户组的权限检查函数
 * 这些函数现在依赖于从JWT token中获取的用户组信息，而不是硬编码的邮箱列表
 */
export const hasAdminPermission = (userGroups: string[]): boolean => {
  return userGroups.includes(UserRole.ADMIN) || userGroups.includes(UserRole.SUPER_ADMIN);
};

export const hasSuperAdminPermission = (userGroups: string[]): boolean => {
  return userGroups.includes(UserRole.SUPER_ADMIN);
};

export const hasTeacherPermission = (userGroups: string[]): boolean => {
  return userGroups.includes(UserRole.TEACHER) || 
         userGroups.includes(UserRole.ADMIN) || 
         userGroups.includes(UserRole.SUPER_ADMIN);
};

export const hasStudentPermission = (userGroups: string[]): boolean => {
  return userGroups.includes(UserRole.STUDENT) || 
         userGroups.includes(UserRole.TEACHER) || 
         userGroups.includes(UserRole.ADMIN) || 
         userGroups.includes(UserRole.SUPER_ADMIN);
};

/**
 * 获取用户的最高权限级别
 */
export const getUserHighestRole = (userGroups: string[]): UserRole => {
  if (userGroups.includes(UserRole.SUPER_ADMIN)) return UserRole.SUPER_ADMIN;
  if (userGroups.includes(UserRole.ADMIN)) return UserRole.ADMIN;
  if (userGroups.includes(UserRole.TEACHER)) return UserRole.TEACHER;
  return UserRole.STUDENT;
};

/**
 * 检查用户是否有特定权限
 */
export const hasPermission = (userGroups: string[], permission: string): boolean => {
  const userRole = getUserHighestRole(userGroups);
  const allowedRoles = PERMISSIONS[permission];
  return allowedRoles ? allowedRoles.includes(userRole) : false;
};

/**
 * 功能权限映射
 */
export const PERMISSIONS = {
  // 学生权限
  TAKE_ASSESSMENT: [UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  VIEW_RESULTS: [UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  
  // 教师权限
  CREATE_COURSE: [UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  MANAGE_KNOWLEDGE_BASE: [UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  SET_ASSESSMENT: [UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN],
  
  // 管理员权限
  UPLOAD_LOGO: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  MANAGE_USERS: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  DELETE_USERS: [UserRole.ADMIN, UserRole.SUPER_ADMIN],
  
  // 超级管理员权限
  CREATE_ADMIN: [UserRole.SUPER_ADMIN],
  ACCESS_LOGS: [UserRole.SUPER_ADMIN],
  PERMISSION_CONTROL: [UserRole.SUPER_ADMIN],
};

/**
 * 用户创建的默认密码规则
 */
export const DEFAULT_USER_PASSWORD = {
  // 默认密码模式：角色前缀 + 随机数字
  pattern: (role: UserRole, id: string) => {
    const prefix = role === UserRole.STUDENT ? 'Student' : 'Teacher';
    return `${prefix}@${id.slice(-4)}`;
  },
  // 密码复杂度要求
  requirements: {
    minLength: 8,
    requireUppercase: false,
    requireLowercase: false,
    requireNumbers: false,
    requireSpecialChars: false
  }
};
