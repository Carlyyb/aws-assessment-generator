// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as ddb from '@aws-appsync/utils/dynamodb';
import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const userId = ctx.identity.sub;
  const { courseId } = ctx.args;
  
  if (!userId) {
    util.error('User not authenticated', 'Unauthorized');
  }
  
  if (!courseId) {
    util.error('CourseId is required', 'BadRequest');
  }
  
  // 使用 Scan 操作查找该课程的知识库，不限制特定用户
  // 这样所有教师都能访问同一课程的知识库
  return {
    operation: 'Scan',
    filter: {
      expression: 'courseId = :courseId',
      expressionValues: util.dynamodb.toMapValues({
        ':courseId': courseId
      })
    }
  };
}

export const response = (ctx) => {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  
  // 如果没有找到记录，返回null
  if (!ctx.result || !ctx.result.items || ctx.result.items.length === 0) {
    return null;
  }
  
  // 获取第一个结果（课程的知识库）
  const knowledgeBase = ctx.result.items[0];
  
  // 确保status字段存在，如果不存在则提供默认值
  if (!knowledgeBase.status) {
    knowledgeBase.status = 'ACTIVE';
  }
  
  return knowledgeBase;
};
