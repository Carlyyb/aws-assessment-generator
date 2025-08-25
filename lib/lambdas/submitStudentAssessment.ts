// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Lambda函数：处理学生测试提交，支持多次尝试功能
 */

import { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { createTimestamp } from '../utils/timeUtils';

// 客户端初始化 - 配置DynamoDB Document Client来处理undefined值
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: {
    removeUndefinedValues: true,  // 自动移除undefined值
    convertEmptyValues: false,
    convertClassInstanceToMap: false,
  },
});
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
 * 根据ID获取Assessment
 */
async function getAssessmentById(assessmentsTableName: string, assessmentId: string) {
  try {
    // 首先尝试使用GSI查询
    const queryResult = await docClient.send(new QueryCommand({
      TableName: assessmentsTableName,
      IndexName: 'id-only',
      KeyConditionExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':id': assessmentId
      },
      Limit: 1
    }));
    
    if (queryResult.Items && queryResult.Items.length > 0) {
      return queryResult.Items[0];
    }
    
    return null;
  } catch (error) {
    console.error('查询assessment失败:', error);
    throw new Error(`无法获取测试信息: ${assessmentId}`);
  }
}

/**
 * 计算最终成绩
 */
function calculateFinalScore(scores: number[], scoreMethod: string): number {
  if (!scores || scores.length === 0) return 0;
  
  switch (scoreMethod) {
    case 'highest':
      return Math.max(...scores);
    case 'lowest':
      return Math.min(...scores);
    case 'average':
      return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    default:
      return Math.max(...scores); // 默认取最高分
  }
}

/**
 * Lambda处理函数
 */
export const handler = async (event: AppSyncResolverEvent<{
  input: {
    parentAssessId: string;
    answers: any;
    score?: number;
    completed?: boolean;
    duration?: number;
    startedAt?: string;
    submittedAt?: string;
  }
}>) => {
  console.log('处理学生测试提交事件:', JSON.stringify(event, null, 2));

  try {
    const userId = (event.identity as any)?.sub || (event.identity as any)?.username;
    if (!userId) {
      throw new Error('无法获取用户ID');
    }

    const { parentAssessId, answers, score, completed, duration } = event.arguments.input;

    // 输入验证
    if (!parentAssessId) {
      throw new Error('parentAssessId 不能为空');
    }

    if (!answers) {
      throw new Error('answers 不能为空');
    }

    // 获取表名
    const assessmentsTableName = await getSystemParameter('/assessment-app/table-names/assessments');
    const studentAssessmentsTableName = await getSystemParameter('/assessment-app/table-names/student-assessments');

    // 获取测试配置 - 使用新的查询函数
    const assessment = await getAssessmentById(assessmentsTableName, parentAssessId);
    
    if (!assessment) {
      throw new Error(`测试不存在: ${parentAssessId}`);
    }

    // 确保assessment有必要的字段
    if (!assessment.assessType) {
      throw new Error('测试类型不正确');
    }

    // 获取现有的学生测试记录
    const existingResult = await docClient.send(new GetCommand({
      TableName: studentAssessmentsTableName,
      Key: { userId, parentAssessId }
    }));

    const existingAssessment = existingResult.Item;
    const attemptLimit = assessment.attemptLimit || 1;
    const allowAnswerChange = assessment.allowAnswerChange ?? true;
    const scoreMethod = assessment.scoreMethod || 'highest';

    // 检查是否允许提交
    if (existingAssessment) {
      const currentAttempts = existingAssessment.attemptCount || 0;
      
      // 如果次数已用尽且不允许修改答案
      if (attemptLimit !== -1 && currentAttempts >= attemptLimit && !allowAnswerChange) {
        throw new Error('已达到测试次数限制');
      }
      
      // 如果只允许一次且不允许修改答案，并且已经完成
      if (attemptLimit === 1 && !allowAnswerChange && existingAssessment.completed) {
        throw new Error('测试已完成，不允许修改');
      }
    }

    const now = createTimestamp();
    const currentAttempts = existingAssessment?.attemptCount || 0;
    
    // 决定是新增尝试还是覆盖最后一次
    let newAttemptCount: number;
    let newScores: number[];
    let newHistory: any[];

    if (!existingAssessment) {
      // 第一次参加
      newAttemptCount = 1;
      newScores = score !== undefined ? [score] : [];
      newHistory = [{
        attemptNumber: 1,
        answers,
        score,
        duration,
        submittedAt: now
      }];
    } else if (allowAnswerChange && attemptLimit === 1) {
      // 允许修改答案且只有一次机会 - 覆盖模式
      newAttemptCount = 1;
      newScores = score !== undefined ? [score] : existingAssessment.scores || [];
      newHistory = [{
        attemptNumber: 1,
        answers,
        score,
        duration,
        submittedAt: now
      }];
    } else {
      // 多次尝试模式 - 新增模式
      newAttemptCount = currentAttempts + 1;
      const existingScores = existingAssessment.scores || [];
      newScores = score !== undefined ? [...existingScores, score] : existingScores;
      const existingHistory = existingAssessment.history || [];
      newHistory = [...existingHistory, {
        attemptNumber: newAttemptCount,
        answers,
        score,
        duration,
        submittedAt: now
      }];
    }

    // 计算最终成绩
    const finalScore = newScores.length > 0 ? calculateFinalScore(newScores, scoreMethod) : undefined;

    // 计算剩余次数
    const remainingAttempts = attemptLimit === -1 ? -1 : Math.max(0, attemptLimit - newAttemptCount);

    // 构建更新的学生测试记录 - 确保所有字段都有有效值
    const updatedStudentAssessment: any = {
      userId,
      parentAssessId,
      answers: answers || {}, // 确保answers不为undefined
      completed: Boolean(completed ?? true), // 确保是布尔值
      updatedAt: now,
      attemptCount: newAttemptCount,
      scores: newScores || [], // 确保是数组
      remainingAttempts: remainingAttempts,
      history: newHistory || [] // 确保是数组
    };

    // 只添加非undefined/null的可选字段
    if (finalScore !== undefined && finalScore !== null) {
      updatedStudentAssessment.score = finalScore;
    }
    
    if (duration !== undefined && duration !== null) {
      updatedStudentAssessment.duration = duration;
    }

    // 保存到数据库
    await docClient.send(new PutCommand({
      TableName: studentAssessmentsTableName,
      Item: updatedStudentAssessment
    }));

    console.log('学生测试提交成功:', updatedStudentAssessment);
    return updatedStudentAssessment;

  } catch (error: any) {
    console.error('处理学生测试提交失败:', error);
    throw new Error(`提交失败: ${error.message}`);
  }
};
