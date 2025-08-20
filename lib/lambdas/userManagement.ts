// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 用户管理 Lambda 函数
 * 处理用户创建、查询等复杂操作
 */

import { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminSetUserPasswordCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

// 客户端初始化
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const cognitoClient = new CognitoIdentityProviderClient({});
const ssmClient = new SSMClient({});

// 接口定义
interface UserInput {
  name: string;
  username: string;
  password?: string;
  role: string;
  email?: string;
}

interface BatchUserResult {
  success: any[];
  failures: any[];
  totalCount: number;
  successCount: number;
  failureCount: number;
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
function generateDefaultPassword(role: string, username: string): string {
  const timestamp = Date.now().toString().slice(-4);
  return `${role}${username}${timestamp}@Aa1`;
}

/**
 * 验证密码复杂度
 */
function validatePassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false;
  return true;
}

/**
 * 检查权限
 */
function checkPermission(groups: string[], targetRole: string): boolean {
  const isSuperAdmin = groups.includes('super_admin');
  const isAdmin = groups.includes('admin');

  // 超级管理员可以创建任何角色
  if (isSuperAdmin) {
    return true;
  }

  // 普通管理员只能创建学生和教师
  if (isAdmin) {
    return targetRole === 'student' || targetRole === 'teacher';
  }

  return false;
}

/**
 * 创建单个用户
 */
async function createSingleUser(userInput: UserInput, userPoolId: string, usersTableName: string, requestorUsername: string): Promise<any> {
  const { name, username, password, role, email } = userInput;

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

  // 在Cognito中创建用户
  const createUserParams = {
    UserPoolId: userPoolId,
    Username: username,
    UserAttributes: [
      { Name: 'preferred_username', Value: name },
      { Name: 'custom:role', Value: role },
      ...(email ? [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' }
      ] : []),
    ],
    TemporaryPassword: finalPassword,
    MessageAction: 'SUPPRESS' as const
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
    case 'student':
      groupName = 'students';
      break;
    case 'teacher':
      groupName = 'teachers';
      break;
    case 'admin':
      groupName = 'admin';
      break;
    case 'super_admin':
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
    needsPasswordChange: !password,
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
}

/**
 * Lambda 主函数
 */
export const handler = async (event: any): Promise<any> => {
  console.log('用户管理 Lambda 请求:', JSON.stringify(event, null, 2));

  const { operation, arguments: args, identity } = event;
  const requestorUsername = identity?.username || 'system';
  const groups = identity?.groups || [];

  try {
    // 获取系统参数
    const [userPoolId, usersTableName] = await Promise.all([
      getSystemParameter('/gen-assess/user-pool-id'),
      getSystemParameter('/gen-assess/users-table-name')
    ]);

    switch (operation) {
      case 'createSingleUser': {
        const { user } = args;
        
        // 检查权限
        if (!checkPermission(groups, user.role)) {
          if (user.role === 'admin') {
            throw new Error('只有超级管理员可以创建管理员账户');
          } else {
            throw new Error('没有权限创建此角色的用户');
          }
        }

        const result = await createSingleUser(user, userPoolId, usersTableName, requestorUsername);
        console.log(`用户 ${user.username} 创建成功`);
        return result;
      }

      case 'batchCreateUsers': {
        const { users } = args;
        
        // 检查权限
        if (!groups.includes('admin') && !groups.includes('super_admin')) {
          throw new Error('没有权限执行此操作');
        }

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
            // 检查是否有权限创建此角色
            if (!checkPermission(groups, userInput.role)) {
              throw new Error(`没有权限创建 ${userInput.role} 角色的用户`);
            }

            const createdUser = await createSingleUser(userInput, userPoolId, usersTableName, requestorUsername);
            result.success.push(createdUser);
            result.successCount++;
          } catch (error: any) {
            const failure = {
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
      }

      case 'listUsers': {
        // 检查权限
        if (!groups.includes('admin') && !groups.includes('super_admin')) {
          throw new Error('没有权限查看用户列表');
        }

        const response = await docClient.send(new ScanCommand({
          TableName: usersTableName,
          FilterExpression: 'isActive = :isActive',
          ExpressionAttributeValues: {
            ':isActive': true
          }
        }));

        return response.Items || [];
      }

      default:
        throw new Error(`未知的操作: ${operation}`);
    }
  } catch (error: any) {
    console.error(`用户管理操作失败:`, error);
    throw new Error(`操作失败: ${error.message}`);
  }
};
