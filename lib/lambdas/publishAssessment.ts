// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { DynamoDBClient, BatchWriteItemCommand, UpdateItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { Handler } from 'aws-lambda';
import { AssessStatus } from '../../ui/src/graphql/API';
import { createTimestamp } from '../utils/timeUtils';

const region = process.env.region!;
const studentsTable = process.env.studentsTable!;
const assessmentsTable = process.env.assessmentsTable!;
const studentAssessmentsTable = process.env.studentAssessmentsTable!;

const dynamoClient = new DynamoDBClient({ region });

export const handler: Handler = async (event) => {
  console.log('PublishAssessment handler called with event:', JSON.stringify(event, null, 2));
  
  const { assessmentId } = event.ctx.arguments;
  const userId = event.ctx.identity.sub;
  
  console.log('Publishing assessment:', { assessmentId, userId });

  const { Items: students }: any = await dynamoClient.send(new ScanCommand({ TableName: studentsTable }));
  if (!students || students.length === 0) {
    console.log('No students found in students table');
    return false;
  }

  console.log(`Found ${students.length} students`);

  // noinspection TypeScriptValidateTypes
  await dynamoClient.send(
    new BatchWriteItemCommand({
      RequestItems: {
        [studentAssessmentsTable]: students.map(({ id }: any) => ({
          PutRequest: {
            Item: {
              userId: {
                S: id.S,
              },
              parentAssessId: {
                S: assessmentId,
              },
              answers: {
                L: [],
              },
              updatedAt: {
                S: createTimestamp(),
              },
            },
          },
        })),
      },
    })
  );

  console.log('Student assessment records created');

  // noinspection TypeScriptValidateTypes
  const updateResult = await dynamoClient.send(
    new UpdateItemCommand({
      TableName: assessmentsTable,
      Key: { id: { S: assessmentId }, userId: { S: userId } },
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
 