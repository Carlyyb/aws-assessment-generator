// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

const ASSESSMENTS_TABLE = process.env.ASSESSMENTS_TABLE!;
const STUDENT_ASSESSMENTS_TABLE = process.env.STUDENT_ASSESSMENTS_TABLE!;

export const handler = async (event: any) => {
  console.log('Delete assessment event:', JSON.stringify(event, null, 2));
  
  try {
    const { field, arguments: args, identity } = event;
    
    if (field !== 'deleteAssessment') {
      throw new Error('Invalid field');
    }
    
    const { id: assessmentId, userId, isAdmin } = args;
    
    // 权限检查
    if (!isAdmin && userId !== identity.sub) {
      throw new Error('Permission denied');
    }
    
    // 首先查询所有相关的学生测试记录
    const studentAssessments = await queryStudentAssessmentsByParentId(assessmentId);
    
    // 删除所有相关的学生测试记录
    const deleteStudentPromises = studentAssessments.map(item => 
      docClient.send(new DeleteCommand({
        TableName: STUDENT_ASSESSMENTS_TABLE,
        Key: {
          userId: item.userId,
          parentAssessId: item.parentAssessId
        }
      }))
    );
    
    // 删除主测试记录
    const deleteAssessmentPromise = docClient.send(new DeleteCommand({
      TableName: ASSESSMENTS_TABLE,
      Key: {
        userId,
        id: assessmentId
      }
    }));
    
    // 并行执行所有删除操作
    await Promise.all([...deleteStudentPromises, deleteAssessmentPromise]);
    
    console.log(`Successfully deleted assessment ${assessmentId} and ${studentAssessments.length} related student assessments`);
    
    return {
      success: true,
      deletedStudentAssessments: studentAssessments.length
    };
    
  } catch (error: any) {
    console.error('Error deleting assessment:', error);
    throw new Error(`Failed to delete assessment: ${error.message}`);
  }
};

// 查询所有与指定测试ID相关的学生测试记录
async function queryStudentAssessmentsByParentId(parentAssessId: string) {
  const results: any[] = [];
  let lastEvaluatedKey: any = undefined;
  
  do {
    // 使用 GSI 查询所有具有指定 parentAssessId 的记录
    const command = new QueryCommand({
      TableName: STUDENT_ASSESSMENTS_TABLE,
      IndexName: 'ParentAssessIdIndex',
      KeyConditionExpression: 'parentAssessId = :parentAssessId',
      ExpressionAttributeValues: {
        ':parentAssessId': parentAssessId
      },
      ExclusiveStartKey: lastEvaluatedKey
    });
    
    const response = await docClient.send(command);
    
    if (response.Items) {
      results.push(...response.Items);
    }
    
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  return results;
}
