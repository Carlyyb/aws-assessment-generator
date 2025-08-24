// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Lambda函数：获取当前用户信息
 * 处理复杂的用户数据查询和分组信息获取
 */

import { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { createTimestamp, getBeijingDateString } from '../utils/timeUtils';

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
    console.error(`获取系统参数 ${paramName} 失败:`, error);
    throw new Error(`无法获取系统参数: ${paramName}`);
  }
}

/**
 * 获取用户所属的学生分组
 */
async function getStudentGroups(userId: string): Promise<string[]> {
  try {
    const studentGroupsTableName = await getSystemParameter('/assessment-app/table-names/student-groups');
    
    const scanParams = {
      TableName: studentGroupsTableName,
      FilterExpression: 'contains(students, :userId)',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    };

    const result = await docClient.send(new ScanCommand(scanParams));
    const groups = result.Items || [];
    
    return groups.map(group => group.id);
  } catch (error) {
    console.error('获取用户分组失败:', error);
    return []; // 如果查询失败，返回空数组
  }
}

/**
 * Lambda处理函数
 */
export const handler = async (event: AppSyncResolverEvent<any>) => {
  console.log('获取当前用户信息 Lambda 事件:', JSON.stringify(event, null, 2));

  try {
    // 获取用户名 - 从AppSync Cognito identity中获取
    const identity = event.identity as any;
    const username = identity?.username || identity?.sub;
    if (!username) {
      throw new Error('无法获取用户身份信息');
    }

    // 获取表名
    const usersTableName = await getSystemParameter('/assessment-app/table-names/users');

    // 查询用户信息
    const getUserParams = {
      TableName: usersTableName,
      Key: {
        id: username
      }
    };

    const userResult = await docClient.send(new GetCommand(getUserParams));
    const user = userResult.Item;

    // 获取用户所属的学生分组
    const studentGroups = await getStudentGroups(username);
    
    if (!user) {
      // 如果DynamoDB中没有用户信息，从Cognito token中构建基本信息
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
        createdAt: createTimestamp(),
        createdBy: 'system',
        studentGroups: studentGroups.length > 0 ? studentGroups : ['ALL']
      };
      
      console.log('返回构建的基本用户信息:', basicUser);
      return basicUser;
    }

    // 更新最后登录时间
    if (user.lastLoginAt !== getBeijingDateString()) {
      const updateParams = {
        TableName: usersTableName,
        Key: {
          id: username
        },
        UpdateExpression: 'SET lastLoginAt = :lastLogin',
        ExpressionAttributeValues: {
          ':lastLogin': createTimestamp()
        }
      };
      
      // 异步更新，不等待结果
      docClient.send(new UpdateCommand(updateParams)).catch(err => {
        console.error('更新最后登录时间失败:', err);
      });
    }

    // 返回用户信息，包含分组信息
    const result = {
      ...user,
      studentGroups: studentGroups.length > 0 ? studentGroups : ['ALL']
    };

    console.log('返回用户信息:', result);
    return result;

  } catch (error: any) {
    console.error('获取当前用户信息失败:', error);
    throw new Error(`获取用户信息失败: ${error.message}`);
  }
};
