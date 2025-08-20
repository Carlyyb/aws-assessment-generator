// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 批量用户创建解析器
 * 支持从Excel表格批量导入用户账号
 * 仅管理员和超级管理员可以使用此功能
 */

import { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminSetUserPasswordCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { UserRole, DEFAULT_USER_PASSWORD } from '../config/adminConfig';

// DynamoDB客户端
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

// Cognito客户端
const cognitoClient = new CognitoIdentityProviderClient({});

// SSM客户端
const ssmClient = new SSMClient({});

// 接口定义
interface BatchUserInput {
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  email?: string;
  phoneNumber?: string;
}

interface BatchUserResult {
  success: any[];
  failures: any[];
  totalCount: number;
  successCount: number;
  failureCount: number;
}

interface UserCreationFailure {
  username: string;
  name: string;
  error: string;
  reason: string;
}

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
 * 检查用户是否已存在（在Cognito中）
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
 * 创建单个用户
 */
async function createSingleUser(
  userInput: BatchUserInput,
  userPoolId: string,
  usersTableName: string,
  requestorUsername: string
): Promise<any> {
  const { name, username, password, role, email, phoneNumber } = userInput;

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

  try {
    await cognitoClient.send(new AdminCreateUserCommand(createUserParams));

    // 设置永久密码
    await cognitoClient.send(new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: username,
      Password: finalPassword,
      Permanent: true
    }));

    // 将用户加入对应分组
    const groupName = role === UserRole.STUDENT ? 'students' : 'teachers';
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
      phoneNumber: phoneNumber || null,
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

    return userRecord;
  } catch (error) {
    console.error(`创建用户 ${username} 失败:`, error);
    throw error;
  }
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
 * 批量创建用户主函数
 */
export const handler = async (event: AppSyncResolverEvent<{ users: BatchUserInput[] }>): Promise<BatchUserResult> => {
  console.log('批量创建用户请求:', JSON.stringify(event, null, 2));

  const { users } = event.arguments;
  const requestorUsername = (event.identity as any)?.username || 'system';

  // 检查权限
  if (!await checkAdminPermission(event)) {
    throw new Error('没有权限执行此操作');
  }

  if (!users || users.length === 0) {
    throw new Error('用户列表不能为空');
  }

  // 获取系统参数
  const [userPoolId, usersTableName] = await Promise.all([
    getSystemParameter('/gen-assess/user-pool-id'),
    getSystemParameter('/gen-assess/users-table-name') // 需要在部署时添加此参数
  ]);

  const result: BatchUserResult = {
    success: [],
    failures: [],
    totalCount: users.length,
    successCount: 0,
    failureCount: 0
  };

  // 逐个创建用户
  for (const userInput of users) {
    try {
      const createdUser = await createSingleUser(userInput, userPoolId, usersTableName, requestorUsername);
      result.success.push(createdUser);
      result.successCount++;
    } catch (error: any) {
      const failure: UserCreationFailure = {
        username: userInput.username,
        name: userInput.name,
        error: error.message,
        reason: error.name || 'Unknown'
      };
      result.failures.push(failure);
      result.failureCount++;
    }
  }

  console.log(`批量创建用户完成: 成功 ${result.successCount}, 失败 ${result.failureCount}`);
  return result;
};