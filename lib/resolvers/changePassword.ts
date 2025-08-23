// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 密码修改解析器
 * 允许用户修改自己的密码
 */

import { AppSyncResolverEvent } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminSetUserPasswordCommand, AdminInitiateAuthCommand, AuthFlowType } from '@aws-sdk/client-cognito-identity-provider';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createTimestamp } from '../utils/timeUtils';

// 客户端初始化
const cognitoClient = new CognitoIdentityProviderClient({});
const ssmClient = new SSMClient({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

interface ChangePasswordInput {
  currentPassword: string;
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
 * 验证密码复杂度
 */
function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: '密码长度至少8个字符' };
  }
  
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: '密码必须包含字母' };
  }
  
  if (!/\d/.test(password)) {
    return { valid: false, message: '密码必须包含数字' };
  }
  
  return { valid: true };
}

/**
 * 验证当前密码
 */
async function validateCurrentPassword(username: string, currentPassword: string, userPoolId: string, userPoolClientId: string): Promise<boolean> {
  try {
    const authParams = {
      AuthFlow: AuthFlowType.ADMIN_NO_SRP_AUTH,
      UserPoolId: userPoolId,
      ClientId: userPoolClientId,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: currentPassword
      }
    };

    await cognitoClient.send(new AdminInitiateAuthCommand(authParams));
    return true;
  } catch (error: any) {
    console.log('当前密码验证失败:', error.name);
    return false;
  }
}

/**
 * 密码修改主函数
 */
export const handler = async (event: AppSyncResolverEvent<{ input: ChangePasswordInput }>): Promise<boolean> => {
  console.log('密码修改请求:', JSON.stringify({ ...event, arguments: { input: { currentPassword: '[HIDDEN]', newPassword: '[HIDDEN]' } } }, null, 2));

  const { input } = event.arguments;
  const { currentPassword, newPassword } = input;
  const username = (event.identity as any)?.username;

  if (!username) {
    throw new Error('无法获取当前用户信息');
  }

  // 验证新密码复杂度
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.message!);
  }

  // 检查新密码是否与当前密码相同
  if (currentPassword === newPassword) {
    throw new Error('新密码不能与当前密码相同');
  }

  try {
    // 获取系统参数
    const [userPoolId, userPoolClientId, usersTableName] = await Promise.all([
      getSystemParameter('/gen-assess/user-pool-id'),
      getSystemParameter('/gen-assess/user-pool-client-id'),
      getSystemParameter('/gen-assess/users-table-name')
    ]);

    // 验证当前密码
    const isCurrentPasswordValid = await validateCurrentPassword(username, currentPassword, userPoolId, userPoolClientId);
    if (!isCurrentPasswordValid) {
      throw new Error('当前密码不正确');
    }

    // 设置新密码
    await cognitoClient.send(new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: username,
      Password: newPassword,
      Permanent: true
    }));

    // 更新用户表中的密码修改状态
    try {
      await docClient.send(new UpdateCommand({
        TableName: usersTableName,
        Key: {
          id: username
        },
        UpdateExpression: 'SET needsPasswordChange = :needsChange, passwordChangedAt = :changedAt',
        ExpressionAttributeValues: {
          ':needsChange': false,
          ':changedAt': createTimestamp()
        }
      }));
    } catch (updateError) {
      console.warn('更新用户表失败，但密码修改成功:', updateError);
    }

    console.log(`用户 ${username} 密码修改成功`);
    return true;

  } catch (error: any) {
    console.error('密码修改失败:', error);
    throw new Error(`密码修改失败: ${error.message}`);
  }
};