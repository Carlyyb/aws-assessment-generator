// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const userId = ctx.identity.sub;
  
  if (!userId) {
    util.error('User not authenticated', 'Unauthorized');
  }

  return {
    operation: 'Query',
    query: {
      expression: 'userId = :userId',
      expressionValues: util.dynamodb.toMapValues({ ':userId': userId }),
    },
    limit: ctx.args?.limit || 50,
    nextToken: ctx.args?.nextToken
  };
}

export const response = (ctx) => {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  
  let items = ctx.result.items || [];
  
  // 清理和验证每个评估模板
  const cleanedItems = items.map(item => {
    let dataUpdated = false;
    
    // 验证必需字段
    const requiredFields = ['userId', 'courseId', 'courseName'];
    for (const field of requiredFields) {
      if (!item[field]) {
        console.error(`Assessment template missing required field '${field}': ${JSON.stringify(item)}`);
        // 标记为无效项目
        item._invalid = true;
        dataUpdated = true;
      }
    }
    
    // 验证状态字段
    const validStatuses = ['ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED'];
    if (item.status && !validStatuses.includes(item.status)) {
      console.log(`Invalid status '${item.status}' found, setting to DRAFT`);
      item.status = 'DRAFT';
      dataUpdated = true;
    } else if (!item.status) {
      item.status = 'DRAFT';
      dataUpdated = true;
    }
    
    // 确保数字字段是有效的
    if (item.questionCount && (isNaN(item.questionCount) || item.questionCount < 0)) {
      console.log(`Invalid questionCount '${item.questionCount}', setting to 0`);
      item.questionCount = 0;
      dataUpdated = true;
    }
    
    // 确保时间戳字段存在
    if (!item.createdAt) {
      item.createdAt = new Date().toISOString();
      dataUpdated = true;
    }
    
    if (!item.updatedAt) {
      item.updatedAt = new Date().toISOString();
      dataUpdated = true;
    }
    
    // 清理空字符串
    if (item.description === '') {
      item.description = `评估模板 - ${item.courseName || 'Unknown Course'}`;
      dataUpdated = true;
    }
    
    if (dataUpdated) {
      console.log(`Assessment template data cleaned for ${item.courseId}: ${JSON.stringify(item)}`);
    }
    
    return item;
  }).filter(item => !item._invalid); // 过滤掉无效项目
  
  // 记录过滤掉的无效项目数量
  if (items.length !== cleanedItems.length) {
    console.log(`Filtered out ${items.length - cleanedItems.length} invalid assessment templates for user ${ctx.identity.sub}`);
  }
  
  return cleanedItems;
};
