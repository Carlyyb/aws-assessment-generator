// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { DynamoDBClient, UpdateItemCommand, ScanCommand, BatchWriteItemCommand } from '@aws-sdk/client-dynamodb';
import { Handler } from 'aws-lambda';
import { AssessStatus } from '../../ui/src/graphql/API';

const region = process.env.region!;
const assessmentsTable = process.env.assessmentsTable!;
const studentAssessmentsTable = process.env.studentAssessmentsTable!;

const dynamoClient = new DynamoDBClient({ region });

export const handler: Handler = async (event) => {
  const { assessmentId } = event.ctx.arguments;
  const userId = event.ctx.identity.sub;

  // 检查管理员权限
  const adminGroups = ['super_admin', 'system_admin'];
  const userGroups = event.ctx.identity?.claims?.['cognito:groups'] || [];
  const isAdmin = adminGroups.some(group => userGroups.includes(group));

  // 取消发布测试
  const updateParams: any = {
    TableName: assessmentsTable,
    Key: { id: { S: assessmentId }, userId: { S: userId } },
    UpdateExpression: 'set published = :published, #st = :status',
    ExpressionAttributeValues: {
      ':published': { BOOL: false },
      ':status': { S: AssessStatus.CREATED },
    },
    ExpressionAttributeNames: {
      '#st': 'status',
    },
    ReturnValues: 'ALL_NEW',
  };

  // 如果不是管理员，添加条件确保只能修改自己的测试
  if (!isAdmin) {
    updateParams.ConditionExpression = 'userId = :userId';
    updateParams.ExpressionAttributeValues[':userId'] = { S: userId };
  }

  await dynamoClient.send(new UpdateItemCommand(updateParams));

  // 删除所有学生的测试记录
  try {
    // 扫描所有与此测试相关的学生记录
    const { Items: studentAssessments }: any = await dynamoClient.send(
      new ScanCommand({
        TableName: studentAssessmentsTable,
        FilterExpression: 'parentAssessId = :assessmentId',
        ExpressionAttributeValues: {
          ':assessmentId': { S: assessmentId }
        }
      })
    );

    if (studentAssessments && studentAssessments.length > 0) {
      // 批量删除学生测试记录
      await dynamoClient.send(
        new BatchWriteItemCommand({
          RequestItems: {
            [studentAssessmentsTable]: studentAssessments.map((item: any) => ({
              DeleteRequest: {
                Key: {
                  userId: item.userId,
                  parentAssessId: item.parentAssessId
                }
              }
            }))
          }
        })
      );
    }
  } catch (error) {
    console.error('Failed to delete student assessments:', error);
    // 不要因为删除学生记录失败而阻止取消发布
  }

  return true;
};
