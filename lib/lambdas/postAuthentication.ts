// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Context, PostAuthenticationTriggerEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { LambdaInterface } from "@aws-lambda-powertools/commons/types";
import { logger, tracer } from "../rag-pipeline/lambdas/event-handler/utils/pt";
import { getParameter } from '@aws-lambda-powertools/parameters/ssm';
import { createTimestamp } from '../utils/timeUtils';

const client = new DynamoDBClient();
const documentClient = DynamoDBDocumentClient.from(client);

class Lambda implements LambdaInterface {
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext({ logEvent: true })
  async handler(event: PostAuthenticationTriggerEvent, lambdaContext: Context) {
    try {
      logger.info('Post authentication trigger started', { 
        username: event.userName,
        userPoolId: event.userPoolId 
      });

      const { userAttributes } = event.request;
      const userId = event.userName;
      const userRole = userAttributes['custom:role'];
      const currentTime = createTimestamp();

      // 根据用户角色更新相应的表
      if (userRole === 'students') {
        await this.updateStudentLastLogin(userId, currentTime);
      } else {
        await this.updateUserLastLogin(userId, currentTime);
      }

      logger.info('Successfully updated lastLoginAt', { 
        userId, 
        userRole, 
        lastLoginAt: currentTime 
      });

    } catch (error) {
      logger.error('Failed to update lastLoginAt', { 
        error: error instanceof Error ? error.message : String(error),
        username: event.userName 
      });
      // 不抛出错误，避免阻止用户登录
    }

    return event;
  }

  /**
   * 更新学生表的最后登录时间
   */
  private async updateStudentLastLogin(userId: string, lastLoginAt: string) {
    try {
      // 获取学生表名
      const studentsTableName = await getParameter('/gen-assess/student-table-name');
      
      const updateCommand = new UpdateCommand({
        TableName: studentsTableName,
        Key: { id: userId },
        UpdateExpression: 'SET lastLoginAt = :lastLoginAt',
        ExpressionAttributeValues: {
          ':lastLoginAt': lastLoginAt
        },
        // 如果记录不存在，不创建新记录
        ConditionExpression: 'attribute_exists(id)'
      });

      await documentClient.send(updateCommand);
      logger.info('Updated student lastLoginAt', { userId, lastLoginAt });
    } catch (error) {
      if ((error as any).name === 'ConditionalCheckFailedException') {
        logger.warn('Student record not found, skipping lastLoginAt update', { userId });
      } else {
        throw error;
      }
    }
  }

  /**
   * 更新用户表的最后登录时间
   */
  private async updateUserLastLogin(userId: string, lastLoginAt: string) {
    try {
      // 获取用户表名
      const usersTableName = await getParameter('/gen-assess/users-table-name');
      
      const updateCommand = new UpdateCommand({
        TableName: usersTableName,
        Key: { id: userId },
        UpdateExpression: 'SET lastLoginAt = :lastLoginAt',
        ExpressionAttributeValues: {
          ':lastLoginAt': lastLoginAt
        },
        // 如果记录不存在，不创建新记录
        ConditionExpression: 'attribute_exists(id)'
      });

      await documentClient.send(updateCommand);
      logger.info('Updated user lastLoginAt', { userId, lastLoginAt });
    } catch (error) {
      if ((error as any).name === 'ConditionalCheckFailedException') {
        logger.warn('User record not found, skipping lastLoginAt update', { userId });
      } else {
        throw error;
      }
    }
  }
}

const handlerClass = new Lambda();
export const postAuthentication = handlerClass.handler.bind(handlerClass);
