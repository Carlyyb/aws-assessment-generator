// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 用户管理 Lambda 函数
 * 处理用户创建、查询等复杂操作
 */

import { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminSetUserPasswordCommand, AdminGetUserCommand, AdminUpdateUserAttributesCommand, AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider';
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
 * 生成默认密码 - 简化格式，8位字符
 */
function generateDefaultPassword(role: string, username: string): string {
  const timestamp = Date.now().toString().slice(-4);
  return `${username}${timestamp}`;
}

/**
 * 验证密码复杂度 - 只需要8位长度
 */
function validatePassword(password: string): boolean {
  return password.length >= 8;
}

/**
 * 解析CSV格式的Excel内容
 */
function parseCSVContent(csvContent: string): { rows: string[][], errors: string[] } {
  const errors: string[] = [];
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    errors.push('文件内容为空');
    return { rows: [], errors };
  }
  
  const rows: string[][] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // 简单的CSV解析，支持逗号分隔
    const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
    
    if (columns.length < 2) {
      errors.push(`第 ${i + 1} 行格式错误：至少需要姓名和用户名两列`);
      continue;
    }
    
    rows.push(columns);
  }
  
  return { rows, errors };
}

/**
 * 验证用户名格式
 */
function validateUsername(username: string): boolean {
  // 用户名应该是3-50个字符，只允许字母、数字、下划线和点
  return /^[a-zA-Z0-9._]{3,50}$/.test(username);
}

/**
 * 验证姓名格式
 */
function validateName(name: string): boolean {
  // 姓名应该是1-100个字符，不能为空
  return name && name.length >= 1 && name.length <= 100;
}

/**
 * 验证邮箱格式
 */
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 将行数据转换为用户输入
 */
function convertRowToUserInput(row: string[], defaultRole: string, rowIndex: number): { user?: any, error?: string } {
  const [name, username, password, email] = row;
  
  // 验证必填字段
  if (!validateName(name)) {
    return { error: `第 ${rowIndex + 1} 行：姓名格式错误` };
  }
  
  if (!validateUsername(username)) {
    return { error: `第 ${rowIndex + 1} 行：用户名格式错误（3-50个字符，只允许字母数字下划线和点）` };
  }
  
  // 验证可选字段
  if (email && !validateEmail(email)) {
    return { error: `第 ${rowIndex + 1} 行：邮箱格式错误` };
  }
  
  const user: any = {
    name: name.trim(),
    username: username.trim(),
    role: defaultRole,
    ...(password && { password: password.trim() }),
    ...(email && { email: email.trim() })
  };
  
  return { user };
}

/**
 * Excel导入预览函数
 */
async function previewExcelImport(fileContent: string): Promise<any> {
  console.log('Excel导入预览开始');

  if (!fileContent || fileContent.trim() === '') {
    throw new Error('文件内容不能为空');
  }

  const result = {
    previewData: [],
    totalRows: 0,
    validRows: 0,
    invalidRows: 0,
    errors: []
  };

  try {
    // 解析CSV内容
    const { rows, errors: parseErrors } = parseCSVContent(fileContent);
    result.errors.push(...parseErrors);
    result.totalRows = rows.length;
    
    if (rows.length === 0) {
      result.errors.push('没有找到有效的数据行');
      return result;
    }
    
    // 假设默认角色为学生，实际使用时可以通过参数传入
    const defaultRole = 'students';
    
    // 处理每一行数据
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const { user, error } = convertRowToUserInput(row, defaultRole, i);
      
      if (error) {
        result.errors.push(error);
        result.invalidRows++;
      } else if (user) {
        result.previewData.push(user);
        result.validRows++;
      }
    }
    
    // 检查重复的用户名
    const usernameSet = new Set<string>();
    const duplicateUsernames: string[] = [];
    
    for (const user of result.previewData) {
      if (usernameSet.has(user.username)) {
        duplicateUsernames.push(user.username);
      } else {
        usernameSet.add(user.username);
      }
    }
    
    if (duplicateUsernames.length > 0) {
      result.errors.push(`发现重复的用户名: ${duplicateUsernames.join(', ')}`);
    }
    
    console.log(`Excel导入预览完成: 总行数 ${result.totalRows}, 有效行 ${result.validRows}, 无效行 ${result.invalidRows}, 错误 ${result.errors.length}`);
    return result;
    
  } catch (error: any) {
    console.error('Excel导入预览失败:', error);
    result.errors.push(`解析文件失败: ${error.message}`);
    return result;
  }
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

  // 返回用户信息，如果是生成的默认密码则包含密码
  return {
    ...userRecord,
    generatedPassword: !password ? finalPassword : undefined
  };
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

      case 'updateUser': {
        const { username, updates } = args;
        
        // 检查权限
        if (!groups.includes('admin') && !groups.includes('super_admin')) {
          throw new Error('没有权限更新用户');
        }

        // 检查是否有权限更新此角色
        if (updates.role && !checkPermission(groups, updates.role)) {
          throw new Error(`没有权限将用户角色更新为 ${updates.role}`);
        }

        try {
          // 更新 DynamoDB 中的用户信息
          const updateExpression = [];
          const expressionAttributeValues = {};
          const expressionAttributeNames = {};

          if (updates.role) {
            updateExpression.push('#role = :role');
            expressionAttributeNames['#role'] = 'role';
            expressionAttributeValues[':role'] = updates.role;
          }

          if (updates.name) {
            updateExpression.push('#name = :name');
            expressionAttributeNames['#name'] = 'name';
            expressionAttributeValues[':name'] = updates.name;
          }

          updateExpression.push('updatedAt = :updatedAt');
          expressionAttributeValues[':updatedAt'] = new Date().toISOString();

          const updateParams = {
            TableName: usersTableName,
            Key: { username },
            UpdateExpression: `SET ${updateExpression.join(', ')}`,
            ExpressionAttributeValues: expressionAttributeValues,
            ...(Object.keys(expressionAttributeNames).length > 0 && { ExpressionAttributeNames: expressionAttributeNames }),
            ReturnValues: 'ALL_NEW' as const
          };

          const updateResult = await docClient.send(new UpdateCommand(updateParams));

          // 如果角色发生变化，更新 Cognito 用户组
          if (updates.role) {
            // 这里可以添加更复杂的组管理逻辑
            // 暂时简化处理
            await cognitoClient.send(new AdminAddUserToGroupCommand({
              UserPoolId: userPoolId,
              Username: username,
              GroupName: updates.role
            }));
          }

          console.log(`用户 ${username} 更新成功`);
          return updateResult.Attributes;
        } catch (error: any) {
          console.error('更新用户失败:', error);
          throw new Error(`更新用户失败: ${error.message}`);
        }
      }

      case 'deleteUser': {
        const { username } = args;
        
        // 检查权限
        if (!groups.includes('admin') && !groups.includes('super_admin')) {
          throw new Error('没有权限删除用户');
        }

        try {
          // 从 Cognito 删除用户
          await cognitoClient.send(new AdminDeleteUserCommand({
            UserPoolId: userPoolId,
            Username: username
          }));

          // 从 DynamoDB 软删除用户（设置 isActive 为 false）
          await docClient.send(new UpdateCommand({
            TableName: usersTableName,
            Key: { username },
            UpdateExpression: 'SET isActive = :isActive, deletedAt = :deletedAt, deletedBy = :deletedBy',
            ExpressionAttributeValues: {
              ':isActive': false,
              ':deletedAt': new Date().toISOString(),
              ':deletedBy': requestorUsername
            }
          }));

          console.log(`用户 ${username} 删除成功`);
          return true;
        } catch (error: any) {
          console.error('删除用户失败:', error);
          throw new Error(`删除用户失败: ${error.message}`);
        }
      }

      case 'previewExcelImport': {
        // 检查权限
        if (!groups.includes('admin') && !groups.includes('super_admin')) {
          throw new Error('没有权限执行此操作');
        }

        const { fileContent } = args;
        if (!fileContent || fileContent.trim() === '') {
          throw new Error('文件内容不能为空');
        }

        return await previewExcelImport(fileContent);
      }

      default:
        throw new Error(`未知的操作: ${operation}`);
    }
  } catch (error: any) {
    console.error(`用户管理操作失败:`, error);
    throw new Error(`操作失败: ${error.message}`);
  }
};
