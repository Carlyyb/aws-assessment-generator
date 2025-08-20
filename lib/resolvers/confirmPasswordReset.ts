// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 密码重置确认解析器
 * 验证重置令牌并设置新密码
 */

import { AppSyncResolverEvent } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminSetUserPasswordCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

// 客户端初始化
const cognitoClient = new CognitoIdentityProviderClient({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const ssmClient = new SSMClient({});

interface PasswordResetConfirmInput {
  identifier: string; // 用户名、邮箱或手机号
  resetToken: string;
  newPassword: string;
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
 * 验证重置令牌
 */
async function validateResetToken(token: string, resetTokenTableName: string): Promise<any> {
  try {
    const response = await docClient.send(new GetCommand({
      TableName: resetTokenTableName,
      Key: { token }
    }));

    const tokenRecord = response.Item;
    if (!tokenRecord) {
      throw new Error('无效的重置令牌');
    }

    if (tokenRecord.used) {
      throw new Error('重置令牌已被使用');
    }

    const expirationTime = new Date(tokenRecord.expiresAt);
    if (new Date() > expirationTime) {
      throw new Error('重置令牌已过期');
    }

    return tokenRecord;
  } catch (error) {
    console.error('验证重置令牌失败:', error);
    throw error;
  }
}

/**
 * 标记令牌为已使用
 */
async function markTokenAsUsed(token: string, resetTokenTableName: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: resetTokenTableName,
    Key: { token },
    UpdateExpression: 'SET used = :used, usedAt = :usedAt',
    ExpressionAttributeValues: {
      ':used': true,
      ':usedAt': new Date().toISOString()
    }
  }));
}

/**
 * 验证密码复杂度
 */
function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: '密码长度至少8个字符' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: '密码必须包含至少一个大写字母' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: '密码必须包含至少一个小写字母' };
  }
  
  if (!/\d/.test(password)) {
    return { valid: false, message: '密码必须包含至少一个数字' };
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: '密码必须包含至少一个特殊字符' };
  }
  
  return { valid: true };
}

/**
 * 更新用户表中的密码修改状态
 */
async function updateUserPasswordStatus(username: string, usersTableName: string): Promise<void> {
  try {
    await docClient.send(new UpdateCommand({
      TableName: usersTableName,
      Key: { id: username },
      UpdateExpression: 'SET needsPasswordChange = :needsChange, passwordChangedAt = :changedAt',
      ExpressionAttributeValues: {
        ':needsChange': false,
        ':changedAt': new Date().toISOString()
      }
    }));
  } catch (error) {
    console.warn('更新用户密码状态失败:', error);
    // 不抛出错误，因为密码已经成功重置
  }
}

/**
 * 密码重置确认主函数
 */
export const handler = async (event: AppSyncResolverEvent<{ input: PasswordResetConfirmInput }>): Promise<boolean> => {
  console.log('密码重置确认请求:', JSON.stringify({ ...event, arguments: { input: { ...event.arguments.input, newPassword: '[HIDDEN]' } } }, null, 2));

  const { input } = event.arguments;
  const { identifier, resetToken, newPassword } = input;

  if (!identifier || !resetToken || !newPassword) {
    throw new Error('所有字段都是必填的');
  }

  // 验证新密码复杂度
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.message!);
  }

  try {
    // 获取系统参数
    const [userPoolId, resetTokenTableName, usersTableName] = await Promise.all([
      getSystemParameter('/gen-assess/user-pool-id'),
      getSystemParameter('/gen-assess/reset-token-table-name'),
      getSystemParameter('/gen-assess/users-table-name')
    ]);

    // 验证重置令牌
    const tokenRecord = await validateResetToken(resetToken, resetTokenTableName);
    
    // 从令牌记录中获取用户名
    const username = tokenRecord.username;

    // 在Cognito中设置新密码
    await cognitoClient.send(new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: username,
      Password: newPassword,
      Permanent: true
    }));

    // 标记令牌为已使用
    await markTokenAsUsed(resetToken, resetTokenTableName);

    // 更新用户表中的密码状态
    await updateUserPasswordStatus(username, usersTableName);

    console.log(`用户 ${username} 密码重置成功`);
    return true;

  } catch (error: any) {
    console.error('密码重置确认失败:', error);
    
    // 根据错误类型返回更友好的错误信息
    if (error.message.includes('无效的重置令牌') || 
        error.message.includes('重置令牌已被使用') || 
        error.message.includes('重置令牌已过期')) {
      throw error;
    }
    
    throw new Error(`密码重置失败: ${error.message}`);
  }
};