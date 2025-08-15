// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
// import { Context } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';
import { util } from '@aws-appsync/utils';

export function request(ctx) {
  let courseId = null;
  
  if (ctx.source && ctx.source.courseId) {
    courseId = ctx.source.courseId;
  } else if (ctx.args && ctx.args.courseId) {
    courseId = ctx.args.courseId;
  }
  
  if (!courseId) {
    util.error('CourseId is required', 'BadRequest');
  }
  
  return ddb.get({ key: { id: courseId } });
}

export const response = (ctx) => {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  
  let result = ctx.result;
  
  if (!result) {
    return null;
  }
  
  // 数据清理和验证
  let dataUpdated = false;
  
  // 验证必需字段
  const requiredFields = ['id', 'name'];
  for (let i = 0; i < requiredFields.length; i++) {
    const field = requiredFields[i];
    if (!result[field]) {
      console.error('Course missing required field "' + field + '": ' + JSON.stringify(result));
      if (field === 'name' && result.id) {
        result.name = 'Course ' + result.id;
        dataUpdated = true;
      }
    }
  }
  
  // 验证状态字段
  const validStatuses = ['ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED'];
  if (result.status && validStatuses.indexOf(result.status) === -1) {
    console.log('Invalid course status "' + result.status + '" found, setting to ACTIVE');
    result.status = 'ACTIVE';
    dataUpdated = true;
  } else if (!result.status) {
    result.status = 'ACTIVE';
    dataUpdated = true;
  }
  
  // 确保时间戳字段存在
  if (!result.createdAt) {
    result.createdAt = new Date().toISOString();
    dataUpdated = true;
  }
  
  if (!result.updatedAt) {
    result.updatedAt = new Date().toISOString();
    dataUpdated = true;
  }
  
  // 清理描述字段
  if (result.description === '') {
    result.description = '课程描述 - ' + result.name;
    dataUpdated = true;
  }
  
  // 验证知识库相关字段
  const validKnowledgeBaseStatuses = ['ACTIVE', 'INACTIVE', 'CREATING', 'FAILED', 'UNKNOWN'];
  if (result.knowledgeBaseStatus && validKnowledgeBaseStatuses.indexOf(result.knowledgeBaseStatus) === -1) {
    console.log('Invalid knowledgeBaseStatus "' + result.knowledgeBaseStatus + '" found, setting to UNKNOWN');
    result.knowledgeBaseStatus = 'UNKNOWN';
    dataUpdated = true;
  }
  
  if (dataUpdated) {
    console.log('Course data cleaned for ' + result.id + ': ' + JSON.stringify(result));
  }
  
  return result;
};
