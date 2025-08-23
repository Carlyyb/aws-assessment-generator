// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { DynamoDBClient, UpdateItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { Handler } from 'aws-lambda';
import { AssessStatus } from '../../ui/src/graphql/API';
import { createTimestamp } from '../utils/timeUtils';

const region = process.env.region!;
const assessmentsTable = process.env.assessmentsTable!;

const dynamoClient = new DynamoDBClient({ region });

export const handler: Handler = async (event) => {
  console.log('PublishAssessment handler called with event:', JSON.stringify(event, null, 2));
  
  const { assessmentId } = event.ctx.arguments;
  const requestUserId = event.ctx.identity?.sub;
  
  console.log('Publishing assessment requested:', { assessmentId, requestUserId });

  // 1) 通过 assessments GSI(id-only) 查找原始评估，得到真正的 ownerUserId
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
  const ownerUserId = ownerItem.userId?.S;
  if (!ownerUserId) {
    console.warn('ownerUserId missing on assessment item', { assessmentId, ownerItem });
    return false;
  }
  console.log('Resolved ownerUserId for assessment:', { assessmentId, ownerUserId });

  // 不再为所有学生创建测评记录，统一在 gradeStudentAssessment 流程中按需写入

  // noinspection TypeScriptValidateTypes
  const updateResult = await dynamoClient.send(
    new UpdateItemCommand({
      TableName: assessmentsTable,
      Key: { id: { S: assessmentId }, userId: { S: ownerUserId } },
      UpdateExpression: 'set published = :published, #st = :status',
      ExpressionAttributeValues: {
        ':published': { BOOL: true },
        ':status': { S: AssessStatus.PUBLISHED },
      },
      ExpressionAttributeNames: {
        '#st': 'status',
      },
      ReturnValues: 'ALL_NEW',
    } as any)
  );

  console.log('Assessment updated:', JSON.stringify(updateResult, null, 2));
  
  return true;
};
 