// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 现有账号迁移解析器
 * 将现有的Cognito账号信息迁移到新的用户表结构中
 * 同时设置默认密码状态和角色信息
 */

import { AppSyncResolverEvent } from 'aws-lambda';
import { CognitoIdentityProviderClient, ListUsersCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { UserRole } from '../config/adminConfig';

// 客户端初始化
const cognitoClient = new CognitoIdentityProviderClient({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
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
 * 检查超级管理员权限
 */
async function checkSuperAdminPermission(event: AppSyncResolverEvent<any>): Promise<boolean> {
  // 获取用户组信息
  const groups = (event.identity as any)?.groups || [];
  return groups.includes('super_admin');
}

/**
 * 获取所有Cognito用户
 */
async function getAllCognitoUsers(userPoolId: string): Promise<any[]> {
  const users: any[] = [];
  let paginationToken: string | undefined;

  do {
    const command = new ListUsersCommand({
      UserPoolId: userPoolId,
      Limit: 60,
      PaginationToken: paginationToken
    });

    const response = await cognitoClient.send(command);
    if (response.Users) {
      users.push(...response.Users);
    }
    paginationToken = response.PaginationToken;
  } while (paginationToken);

  return users;
}

/**
 * 获取用户详细信息（包括自定义属性）
 */
async function getUserDetails(username: string, userPoolId: string): Promise<any> {
  try {
    const response = await cognitoClient.send(new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: username
    }));
    return response;
  } catch (error) {
    console.error(`获取用户 ${username} 详情失败:`, error);
    return null;
  }
}

/**
 * 解析用户属性
 */
function parseUserAttributes(userAttributes: any[]): any {
  const attributes: any = {};
  
  if (userAttributes) {
    for (const attr of userAttributes) {
      if (attr.Name === 'email') {
        attributes.email = attr.Value;
      } else if (attr.Name === 'phone_number') {
        attributes.phoneNumber = attr.Value;
      } else if (attr.Name === 'name') {
        attributes.name = attr.Value;
      } else if (attr.Name === 'custom:role') {
        attributes.role = attr.Value;
      }
    }
  }
  
  return attributes;
}

/**
 * 检查用户是否已在新表中存在
 */
async function userExistsInNewTable(username: string, usersTableName: string): Promise<boolean> {
  try {
    const response = await docClient.send(new ScanCommand({
      TableName: usersTableName,
      FilterExpression: 'id = :username OR username = :username',
      ExpressionAttributeValues: {
        ':username': username
      },
      Limit: 1
    }));
    
    return response.Items && response.Items.length > 0;
  } catch (error) {
    console.error(`检查用户 ${username} 是否存在失败:`, error);
    return false;
  }
}

/**
 * 迁移单个用户
 */
async function migrateUser(cognitoUser: any, userPoolId: string, usersTableName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const username = cognitoUser.Username;
    
    // 检查用户是否已迁移
    if (await userExistsInNewTable(username, usersTableName)) {
      console.log(`用户 ${username} 已存在，跳过迁移`);
      return { success: true };
    }

    // 获取用户详细信息
    const userDetails = await getUserDetails(username, userPoolId);
    if (!userDetails) {
      return { success: false, error: '无法获取用户详情' };
    }

    // 解析用户属性
    const attributes = parseUserAttributes(userDetails.UserAttributes);
    
    // 确定用户角色
    let role = UserRole.STUDENT; // 默认为学生
    if (attributes.role) {
      if (attributes.role === 'teachers') {
        role = UserRole.TEACHER;
      } else if (attributes.role === 'admin') {
        role = UserRole.ADMIN;
      } else if (attributes.role === 'super_admin') {
        role = UserRole.SUPER_ADMIN;
      }
    }

    // 创建用户记录
    const userRecord = {
      id: username,
      username,
      name: attributes.name || username,
      email: attributes.email || null,
      phoneNumber: attributes.phoneNumber || null,
      role,
      needsPasswordChange: cognitoUser.UserStatus === 'FORCE_CHANGE_PASSWORD',
      lastLoginAt: null,
      createdAt: cognitoUser.UserCreateDate ? cognitoUser.UserCreateDate.toISOString() : new Date().toISOString(),
      createdBy: 'migration',
      isActive: cognitoUser.UserStatus === 'CONFIRMED' || cognitoUser.UserStatus === 'FORCE_CHANGE_PASSWORD'
    };

    // 保存到DynamoDB
    await docClient.send(new PutCommand({
      TableName: usersTableName,
      Item: userRecord,
      ConditionExpression: 'attribute_not_exists(id)' // 确保不覆盖已有记录
    }));

    console.log(`用户 ${username} 迁移成功`);
    return { success: true };

  } catch (error: any) {
    console.error(`迁移用户失败:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * 现有账号迁移主函数
 */
export const handler = async (event: AppSyncResolverEvent<{}>): Promise<any> => {
  console.log('开始现有账号迁移:', JSON.stringify(event, null, 2));

  // 检查权限
  if (!await checkSuperAdminPermission(event)) {
    throw new Error('只有超级管理员可以执行账号迁移');
  }

  try {
    // 获取系统参数
    const [userPoolId, usersTableName] = await Promise.all([
      getSystemParameter('/gen-assess/user-pool-id'),
      getSystemParameter('/gen-assess/users-table-name')
    ]);

    // 获取所有Cognito用户
    const cognitoUsers = await getAllCognitoUsers(userPoolId);
    console.log(`找到 ${cognitoUsers.length} 个Cognito用户`);

    const migrationResults = {
      totalUsers: cognitoUsers.length,
      migratedUsers: 0,
      skippedUsers: 0,
      failedUsers: 0,
      errors: [] as string[]
    };

    // 迁移每个用户
    for (const cognitoUser of cognitoUsers) {
      const result = await migrateUser(cognitoUser, userPoolId, usersTableName);
      
      if (result.success) {
        if (result.error) {
          migrationResults.skippedUsers++;
        } else {
          migrationResults.migratedUsers++;
        }
      } else {
        migrationResults.failedUsers++;
        migrationResults.errors.push(`${cognitoUser.Username}: ${result.error}`);
      }
    }

    console.log('迁移完成:', migrationResults);
    return migrationResults;

  } catch (error: any) {
    console.error('账号迁移失败:', error);
    throw new Error(`账号迁移失败: ${error.message}`);
  }
};