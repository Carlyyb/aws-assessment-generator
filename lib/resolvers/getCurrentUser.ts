// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 获取当前用户信息解析器
 * 返回当前登录用户的详细信息
 */

import { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

// 客户端初始化
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
 * 获取当前用户信息主函数
 */
export const handler = async (event: AppSyncResolverEvent<{}>): Promise<any> => {
  console.log('获取当前用户信息请求:', JSON.stringify(event, null, 2));

  const username = (event.identity as any)?.username;
  
  if (!username) {
    throw new Error('无法获取当前用户信息');
  }

  try {
    // 获取用户表名
    const usersTableName = await getSystemParameter('/gen-assess/users-table-name');

    // 从DynamoDB获取用户信息
    const response = await docClient.send(new GetCommand({
      TableName: usersTableName,
      Key: {
        id: username
      }
    }));

    const user = response.Item;
    
    if (!user) {
      // 如果DynamoDB中没有用户信息，从Cognito token中构建基本信息
      // 获取用户的 Cognito 用户组信息
      const cognitoGroups = (event.identity as any)?.groups || [];
      const claims = (event.identity as any)?.claims || {};
      
      const basicUser = {
        id: username,
        username,
        name: claims.name || username,
        email: claims.email,
        role: cognitoGroups[0] || 'students',
        needsPasswordChange: false,
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      };
      
      return basicUser;
    }

    // 更新最后登录时间
    if (user.lastLoginAt !== new Date().toISOString().split('T')[0]) {
      const updateParams = {
        TableName: usersTableName,
        Key: {
          id: username
        },
        UpdateExpression: 'SET lastLoginAt = :lastLogin',
        ExpressionAttributeValues: {
          ':lastLogin': new Date().toISOString()
        }
      };
      
      // 异步更新，不等待结果
      docClient.send(new UpdateCommand(updateParams)).catch(err => {
        console.error('更新最后登录时间失败:', err);
      });
    }

    return user;

  } catch (error: any) {
    console.error('获取当前用户信息失败:', error);
    throw new Error(`获取用户信息失败: ${error.message}`);
  }
};