// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { DynamoDBClient, UpdateItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { Handler } from 'aws-lambda';
import { AssessStatus } from '../../ui/src/graphql/API';

const region = process.env.region!;
const assessmentsTable = process.env.assessmentsTable!;

const dynamoClient = new DynamoDBClient({ region });

export const handler: Handler = async (event) => {
  const { assessmentId } = event.ctx.arguments;
  const requestUserId = event.ctx.identity?.sub;

  // 检查管理员权限
  const adminGroups = ['super_admin', 'system_admin'];
  const userGroups = event.ctx.identity?.claims?.['cognito:groups'] || [];
  const isAdmin = adminGroups.some(group => userGroups.includes(group));

  // 1) 通过 assessments 的 GSI(id-only) 获取真实 ownerUserId，避免错误使用调用者 userId 导致创建新记录
  const assessQuery = await dynamoClient.send(new QueryCommand({
    TableName: assessmentsTable,
    IndexName: 'id-only',
    KeyConditionExpression: '#id = :id',
    ExpressionAttributeNames: { '#id': 'id' },
    ExpressionAttributeValues: { ':id': { S: assessmentId } },
    Limit: 1,
  }));

  const ownerItem = assessQuery.Items?.[0];
  if (!ownerItem) {
    console.warn('Assessment not found by id on GSI', { assessmentId });
    return false;
  }
  const ownerUserId = ownerItem.userId?.S as string | undefined;
  if (!ownerUserId) {
    console.warn('ownerUserId missing on assessment item', { assessmentId, ownerItem });
    return false;
  }

  // 2) 权限校验：非管理员只能操作自己的测评
  if (!isAdmin && requestUserId !== ownerUserId) {
    console.warn('Unauthorized unpublish attempt', { assessmentId, requestUserId, ownerUserId });
    return false;
  }

  // 3) 仅更新 published 与 status；并添加存在性条件，避免误创建新记录
  await dynamoClient.send(new UpdateItemCommand({
    TableName: assessmentsTable,
    Key: { id: { S: assessmentId }, userId: { S: ownerUserId } },
    UpdateExpression: 'set published = :published, #st = :status',
    ExpressionAttributeValues: {
      ':published': { BOOL: false },
      ':status': { S: AssessStatus.CREATED },
    },
    ExpressionAttributeNames: { '#st': 'status' },
    ConditionExpression: 'attribute_exists(id) AND attribute_exists(userId)',
    ReturnValues: 'ALL_NEW',
  } as any));

  // 4) 不清空学生历史数据：保留 StudentAssessments 表中的记录

  return true;
};
