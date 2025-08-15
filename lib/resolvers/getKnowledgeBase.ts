// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as ddb from '@aws-appsync/utils/dynamodb';
import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const userId = ctx.identity.sub;
  const courseId = ctx.args.courseId;
  
  if (!userId) {
    util.error('User not authenticated', 'Unauthorized');
  }
  
  if (!courseId) {
    util.error('CourseId is required', 'BadRequest');
  }
  
  // 使用复合键查询知识库
  const key = {
    userId: userId,
    courseId: courseId
  };
  
  return ddb.get({ key });
}

export const response = (ctx) => {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  
  let result = ctx.result;
  
  // 数据清理和验证
  if (result) {
    // 确保所有必需字段都存在
    const requiredFields = ['userId', 'courseId', 'knowledgeBaseId', 'status'];
    const missingFields = [];
    
    for (let i = 0; i < requiredFields.length; i++) {
      const field = requiredFields[i];
      if (!result[field]) {
        missingFields.push(field);
      }
    }
    
    // 如果缺少关键字段，设置默认值或标记为需要清理
    if (missingFields.length > 0) {
      console.log('Knowledge base record missing fields: ' + missingFields.join(', ') + ' for user ' + result.userId + ', course ' + result.courseId);
      
      // 设置默认状态
      if (!result.status) {
        result.status = 'UNKNOWN';
        console.log('Set default status to UNKNOWN for knowledge base ' + result.knowledgeBaseId);
      }
      
      // 如果缺少核心字段，返回null并记录
      if (!result.knowledgeBaseId) {
        console.error('Critical field knowledgeBaseId missing, marking record for cleanup: ' + JSON.stringify(result));
        // 这里可以触发清理作业或发送警报
        return null;
      }
    }
    
    // 验证状态值
    const validStatuses = ['ACTIVE', 'INACTIVE', 'CREATING', 'FAILED', 'UNKNOWN'];
    if (result.status && validStatuses.indexOf(result.status) === -1) {
      console.log('Invalid status "' + result.status + '" found, setting to UNKNOWN');
      result.status = 'UNKNOWN';
    }
    
    // 确保字符串字段不为空
    if (result.indexName === '') {
      result.indexName = 'index-' + result.courseId;
    }
    if (result.s3prefix === '') {
      result.s3prefix = 'KnowledgeBases/' + result.userId + '/' + result.courseId + '/';
    }
  }
  
  return result;
};
