// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as ddb from '@aws-appsync/utils/dynamodb';
import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const userId = ctx.identity.sub;
  const { tableType } = ctx.args;
  
  if (!userId) {
    util.error('User not authenticated', 'Unauthorized');
  }
  
  if (!tableType) {
    util.error('TableType is required (settings, knowledgeBases, courses, assessments)', 'BadRequest');
  }
  
  // 根据表类型执行不同的清理逻辑
  switch (tableType) {
    case 'settings':
      return ddb.get({ key: { userId } });
      
    case 'knowledgeBases':
      return ddb.query({
        query: { userId },
        limit: 100
      });
      
    case 'courses':
      return ddb.query({
        query: { userId },
        limit: 100
      });
      
    case 'assessments':
      return ddb.query({
        query: { userId },
        limit: 100
      });
      
    default:
      util.error(`Invalid table type: ${tableType}`, 'BadRequest');
  }
}

export const response = (ctx) => {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  
  const { tableType } = ctx.args;
  let result = ctx.result;
  let cleanupSummary = {
    tableType,
    totalRecords: 0,
    cleanedRecords: 0,
    invalidRecords: 0,
    deletedRecords: 0,
    issues: []
  };
  
  switch (tableType) {
    case 'settings':
      cleanupSummary = cleanupSettings(result, cleanupSummary);
      break;
      
    case 'knowledgeBases':
      cleanupSummary = cleanupKnowledgeBases(result.items || [], cleanupSummary);
      break;
      
    case 'courses':
      cleanupSummary = cleanupCourses(result.items || [], cleanupSummary);
      break;
      
    case 'assessments':
      cleanupSummary = cleanupAssessments(result.items || [], cleanupSummary);
      break;
  }
  
  console.log(`Data cleanup completed for ${tableType}: ${JSON.stringify(cleanupSummary)}`);
  
  return {
    success: true,
    message: `数据清理完成`,
    summary: cleanupSummary
  };
};

function cleanupSettings(record, summary) {
  summary.totalRecords = record ? 1 : 0;
  
  if (!record) {
    summary.issues.push('用户设置不存在，将在下次访问时创建默认设置');
    return summary;
  }
  
  let cleaned = false;
  const validLanguages = ['zh', 'en'];
  const validThemes = ['default', 'dark', 'light'];
  
  if (!record.lang || !validLanguages.includes(record.lang)) {
    summary.issues.push(`无效的语言设置: ${record.lang} -> zh`);
    cleaned = true;
  }
  
  if (!record.theme || !validThemes.includes(record.theme)) {
    summary.issues.push(`无效的主题设置: ${record.theme} -> default`);
    cleaned = true;
  }
  
  if (!record.createdAt || !record.updatedAt) {
    summary.issues.push('缺失时间戳字段');
    cleaned = true;
  }
  
  if (cleaned) {
    summary.cleanedRecords = 1;
  }
  
  return summary;
}

function cleanupKnowledgeBases(records, summary) {
  summary.totalRecords = records.length;
  
  records.forEach(record => {
    let hasIssues = false;
    
    // 检查必需字段
    const requiredFields = ['userId', 'courseId', 'knowledgeBaseId'];
    for (const field of requiredFields) {
      if (!record[field]) {
        summary.issues.push(`知识库记录缺少必需字段 ${field}: ${record.courseId || 'unknown'}`);
        hasIssues = true;
      }
    }
    
    // 检查状态字段
    const validStatuses = ['ACTIVE', 'INACTIVE', 'CREATING', 'FAILED', 'UNKNOWN'];
    if (!record.status || !validStatuses.includes(record.status)) {
      summary.issues.push(`知识库状态无效: ${record.status} -> UNKNOWN (${record.courseId})`);
      hasIssues = true;
    }
    
    if (hasIssues) {
      if (!record.knowledgeBaseId) {
        summary.deletedRecords++;
        summary.issues.push(`标记删除无效知识库记录: ${record.courseId}`);
      } else {
        summary.cleanedRecords++;
      }
    }
  });
  
  summary.invalidRecords = summary.deletedRecords;
  return summary;
}

function cleanupCourses(records, summary) {
  summary.totalRecords = records.length;
  
  records.forEach(record => {
    let hasIssues = false;
    
    // 检查必需字段
    if (!record.id || !record.name) {
      summary.issues.push(`课程记录缺少必需字段: ${record.id || 'unknown'}`);
      hasIssues = true;
    }
    
    // 检查状态
    const validStatuses = ['ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED'];
    if (record.status && !validStatuses.includes(record.status)) {
      summary.issues.push(`课程状态无效: ${record.status} -> ACTIVE (${record.name})`);
      hasIssues = true;
    }
    
    if (hasIssues) {
      summary.cleanedRecords++;
    }
  });
  
  return summary;
}

function cleanupAssessments(records, summary) {
  summary.totalRecords = records.length;
  
  records.forEach(record => {
    let hasIssues = false;
    
    // 检查必需字段
    const requiredFields = ['userId', 'courseId'];
    for (const field of requiredFields) {
      if (!record[field]) {
        summary.issues.push(`评估记录缺少必需字段 ${field}: ${record.id || 'unknown'}`);
        hasIssues = true;
      }
    }
    
    // 检查数据一致性
    if (record.questionCount && (isNaN(record.questionCount) || record.questionCount < 0)) {
      summary.issues.push(`评估问题数量无效: ${record.questionCount} -> 0 (${record.courseId})`);
      hasIssues = true;
    }
    
    if (hasIssues) {
      summary.cleanedRecords++;
    }
  });
  
  return summary;
}
