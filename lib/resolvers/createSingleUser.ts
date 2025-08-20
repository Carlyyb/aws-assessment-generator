// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 单个用户创建解析器
 * 管理员可以创建单个用户账号
 */

interface BatchUserInput {
  name: string;        // 显示名称
  username: string;    // 账号名
  password?: string;   // 密码（可选）
  role: UserRole;      // 用户角色
  email?: string;      // 邮箱（可选）
}

import { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminSetUserPasswordCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { UserRole, DEFAULT_USER_PASSWORD } from '../config/adminConfig';

// 客户端初始化
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const cognitoClient = new CognitoIdentityProviderClient({});
const ssmClient = new SSMClient({});

/**
 * 获取系统参数
 */
async function getSystemParameter(paramName: string): Promise<string> {
  try {
    const response = await ssmClient.send(new GetParameterCommand({
      Name: paramName,
      WithDecryption: true
    }));
    return response.Parameter?.Value || '';
  } catch (error) {
    console.error(`获取参数 ${paramName} 失败:`, error);
    throw new Error(`Failed to get parameter: ${paramName}`);
  }
}

/**
 * 检查用户是否已存在
 */
async function checkUserExists(username: string, userPoolId: string): Promise<boolean> {
  try {
    await cognitoClient.send(new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: username
    }));
    return true;
  } catch (error: any) {
    if (error.name === 'UserNotFoundException') {
      return false;
    }
    throw error;
  }
}

/**
 * 生成默认密码
 */
function generateDefaultPassword(role: UserRole, username: string): string {
  const timestamp = Date.now().toString().slice(-4);
  return DEFAULT_USER_PASSWORD.pattern(role, username + timestamp);
}

/**
 * 验证密码复杂度
 */
function validatePassword(password: string): boolean {
  const requirements = DEFAULT_USER_PASSWORD.requirements;
  
  if (password.length < requirements.minLength) return false;
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) return false;
  if (requirements.requireLowercase && !/[a-z]/.test(password)) return false;
  if (requirements.requireNumbers && !/\d/.test(password)) return false;
  if (requirements.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false;
  
  return true;
}

/**
 * 检查管理员权限
 */
async function checkAdminPermission(event: AppSyncResolverEvent<any>): Promise<boolean> {
  // 获取用户组信息
  const groups = (event.identity as any)?.groups || [];
  return groups.includes('admin') || groups.includes('super_admin');
}

/**
 * 检查超级管理员权限
 */
async function checkSuperAdminPermission(event: AppSyncResolverEvent<any>): Promise<boolean> {
  // 获取用户组信息
  const groups = (event.identity as any)?.groups || [];
  return groups.includes('super_admin');
}

/**
 * 检查是否有权限创建指定角色的用户
 */
async function checkCreateUserPermission(event: AppSyncResolverEvent<any>, targetRole: UserRole): Promise<boolean> {
  const groups = (event.identity as any)?.groups || [];
  const isSuperAdmin = groups.includes('super_admin');
  const isAdmin = groups.includes('admin');

  // 超级管理员可以创建任何角色（包括admin）
  if (isSuperAdmin) {
    return true;
  }

  // 普通管理员只能创建学生和教师
  if (isAdmin) {
    return targetRole === UserRole.STUDENT || targetRole === UserRole.TEACHER;
  }

  return false;
}

/**
 * 创建单个用户主函数
 */
export const handler = async (event: AppSyncResolverEvent<{ user: BatchUserInput }>): Promise<any> => {
  console.log('创建单个用户请求:', JSON.stringify(event, null, 2));

  const { user } = event.arguments;
  const requestorUsername = (event.identity as any)?.username || 'system';

  if (!user) {
    throw new Error('用户信息不能为空');
  }

  const { name, username, password, role, email } = user;

  // 检查是否有权限创建此角色的用户
  if (!await checkCreateUserPermission(event, role)) {
    if (role === UserRole.ADMIN) {
      throw new Error('只有超级管理员可以创建管理员账户');
    } else {
      throw new Error('没有权限创建此角色的用户');
    }
  }

  // 获取系统参数
  const [userPoolId, usersTableName] = await Promise.all([
    getSystemParameter('/gen-assess/user-pool-id'),
    getSystemParameter('/gen-assess/users-table-name')
  ]);

  // 检查用户是否已存在
  const userExists = await checkUserExists(username, userPoolId);
  if (userExists) {
    throw new Error(`用户 ${username} 已存在`);
  }

  // 生成或验证密码
  const finalPassword = password || generateDefaultPassword(role, username);
  if (!validatePassword(finalPassword)) {
    throw new Error(`密码不符合复杂度要求`);
  }

  try {
    // 在Cognito中创建用户 - 只设置必需属性
    const createUserParams = {
      UserPoolId: userPoolId,
      Username: username, // 账号名（必需）
      UserAttributes: [
        // 显示名称（对应前端的name字段）
        { Name: 'preferred_username', Value: name },
        // 用户角色（必需）
        { Name: 'custom:role', Value: role },
        // 可选：邮箱（仅在提供时设置，用于密码恢复）
        ...(email ? [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' }
        ] : []),
      ],
      TemporaryPassword: finalPassword, // 临时密码
      MessageAction: 'SUPPRESS' as const // 不发送欢迎邮件
    };

    await cognitoClient.send(new AdminCreateUserCommand(createUserParams));

    // 设置永久密码
    await cognitoClient.send(new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: username,
      Password: finalPassword,
      Permanent: true
    }));

    // 将用户加入对应分组
    let groupName: string;
    switch (role) {
      case UserRole.STUDENT:
        groupName = 'students';
        break;
      case UserRole.TEACHER:
        groupName = 'teachers';
        break;
      case UserRole.ADMIN:
        groupName = 'admin';
        break;
      case UserRole.SUPER_ADMIN:
        groupName = 'super_admin';
        break;
      default:
        throw new Error(`未知的用户角色: ${role}`);
    }
    
    await cognitoClient.send(new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: username,
      GroupName: groupName
    }));

    // 保存用户信息到DynamoDB
    const userRecord = {
      id: username,
      username,
      name,
      email: email || null,
      role,
      needsPasswordChange: !password, // 如果没有自定义密码，需要修改
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      createdBy: requestorUsername,
      isActive: true
    };

    await docClient.send(new PutCommand({
      TableName: usersTableName,
      Item: userRecord
    }));

    console.log(`用户 ${username} 创建成功`);
    return userRecord;

  } catch (error: any) {
    console.error(`创建用户 ${username} 失败:`, error);
    throw new Error(`创建用户失败: ${error.message}`);
  }
};