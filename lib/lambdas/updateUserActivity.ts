// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Context, APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { LambdaInterface } from "@aws-lambda-powertools/commons/types";
import { logger, tracer } from "../rag-pipeline/lambdas/event-handler/utils/pt";
import { getParameter } from '@aws-lambda-powertools/parameters/ssm';
import { createTimestamp } from '../utils/timeUtils';

const client = new DynamoDBClient();
const documentClient = DynamoDBDocumentClient.from(client);

interface UpdateActivityRequest {
  username: string;
  role?: string;
}

class Lambda implements LambdaInterface {
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext({ logEvent: true })
  async handler(event: APIGatewayProxyEvent, lambdaContext: Context): Promise<APIGatewayProxyResult> {
    try {
      logger.info('User activity update started', { 
        requestId: lambdaContext.awsRequestId,
        userAgent: event.headers['User-Agent']
      });

      // 解析请求体
      let requestBody: UpdateActivityRequest;
      try {
        requestBody = JSON.parse(event.body || '{}');
      } catch (parseError) {
        logger.error('Failed to parse request body', { error: parseError });
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'POST,OPTIONS'
          },
          body: JSON.stringify({
            success: false,
            message: 'Invalid request body'
          })
        };
      }

      const { username, role } = requestBody;

      if (!username) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'POST,OPTIONS'
          },
          body: JSON.stringify({
            success: false,
            message: 'Username is required'
          })
        };
      }

      const currentTime = createTimestamp();

      // 根据用户角色更新相应的表
      if (role === 'students') {
        await this.updateStudentActivity(username, currentTime);
      } else {
        await this.updateUserActivity(username, currentTime);
      }

      logger.info('Successfully updated user activity', { 
        username, 
        role, 
        lastActivityAt: currentTime 
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          message: 'User activity updated successfully',
          lastLoginAt: currentTime
        })
      };

    } catch (error) {
      logger.error('Failed to update user activity', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        body: JSON.stringify({
          success: false,
          message: 'Internal server error'
        })
      };
    }
  }

  /**
   * 更新学生表的最后活跃时间
   */
  private async updateStudentActivity(userId: string, lastActivityAt: string) {
    try {
      // 获取学生表名
      const studentsTableName = await getParameter('/gen-assess/student-table-name');
      
      const updateCommand = new UpdateCommand({
        TableName: studentsTableName,
        Key: { id: userId },
        UpdateExpression: 'SET lastLoginAt = :lastLoginAt',
        ExpressionAttributeValues: {
          ':lastLoginAt': lastActivityAt
        },
        // 如果记录不存在，不创建新记录
        ConditionExpression: 'attribute_exists(id)'
      });

      await documentClient.send(updateCommand);
      logger.info('Updated student activity', { userId, lastLoginAt: lastActivityAt });
    } catch (error) {
      if ((error as any).name === 'ConditionalCheckFailedException') {
        logger.warn('Student record not found, skipping activity update', { userId });
      } else {
        throw error;
      }
    }
  }

  /**
   * 更新用户表的最后活跃时间
   */
  private async updateUserActivity(userId: string, lastActivityAt: string) {
    try {
      // 获取用户表名
      const usersTableName = await getParameter('/gen-assess/users-table-name');
      
      const updateCommand = new UpdateCommand({
        TableName: usersTableName,
        Key: { id: userId },
        UpdateExpression: 'SET lastLoginAt = :lastLoginAt',
        ExpressionAttributeValues: {
          ':lastLoginAt': lastActivityAt
        },
        // 如果记录不存在，不创建新记录
        ConditionExpression: 'attribute_exists(id)'
      });

      await documentClient.send(updateCommand);
      logger.info('Updated user activity', { userId, lastLoginAt: lastActivityAt });
    } catch (error) {
      if ((error as any).name === 'ConditionalCheckFailedException') {
        logger.warn('User record not found, skipping activity update', { userId });
      } else {
        throw error;
      }
    }
  }
}

const handlerClass = new Lambda();
export const updateUserActivity = handlerClass.handler.bind(handlerClass);
