// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 用户列表查询解析器
 * 管理员可以查看所有用户列表，支持按角色过滤
 */

import { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { UserRole } from '../config/adminConfig';

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
 * 检查管理员权限
 */
async function checkAdminPermission(event: AppSyncResolverEvent<any>): Promise<boolean> {
  // 获取用户组信息
  const groups = (event.identity as any)?.groups || [];
  return groups.includes('admin') || groups.includes('super_admin');
}

/**
 * 用户列表查询主函数
 */
export const handler = async (event: AppSyncResolverEvent<{ role?: UserRole }>): Promise<any[]> => {
  console.log('用户列表查询请求:', JSON.stringify(event, null, 2));

  const { role } = event.arguments;

  // 检查权限
  if (!await checkAdminPermission(event)) {
    throw new Error('没有权限执行此操作');
  }

  try {
    // 获取用户表名
    const usersTableName = await getSystemParameter('/gen-assess/users-table-name');

    let users: any[] = [];

    if (role) {
      // 按角色查询（假设有GSI按role查询）
      const queryParams = {
        TableName: usersTableName,
        IndexName: 'RoleIndex', // 需要在表中创建这个GSI
        KeyConditionExpression: '#role = :role',
        ExpressionAttributeNames: {
          '#role': 'role'
        },
        ExpressionAttributeValues: {
          ':role': role
        }
      };

      const response = await docClient.send(new QueryCommand(queryParams));
      users = response.Items || [];
    } else {
      // 获取所有用户
      const scanParams = {
        TableName: usersTableName,
        FilterExpression: 'attribute_exists(#role)',
        ExpressionAttributeNames: {
          '#role': 'role'
        }
      };

      const response = await docClient.send(new ScanCommand(scanParams));
      users = response.Items || [];
    }

    // 排序：按创建时间降序
    users.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });

    console.log(`查询到 ${users.length} 个用户`);
    return users;

  } catch (error: any) {
    console.error('用户列表查询失败:', error);
    throw new Error(`查询用户列表失败: ${error.message}`);
  }
};