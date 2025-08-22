// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'Query',
    query: {
      expression: 'userId = :userId',
      expressionValues: util.dynamodb.toMapValues({ ':userId': ctx.identity.sub }),
    },
  };
}

// 清理数据函数，处理类型不匹配的问题
function sanitizeAssessmentData(assessment) {
  if (!assessment) return assessment;
  
  // 处理multiChoiceAssessment
  if (assessment.multiChoiceAssessment && Array.isArray(assessment.multiChoiceAssessment)) {
    assessment.multiChoiceAssessment = assessment.multiChoiceAssessment.map(question => {
      if (!question) return question;
      
      // 检查correctAnswer是否为数组，如果是则设为null
      if (Array.isArray(question.correctAnswer)) {
        question.correctAnswer = null;
      }
      
      // 检查其他可能的数组字段
      if (Array.isArray(question.question)) {
        question.question = null;
      }
      
      if (Array.isArray(question.explanation)) {
        question.explanation = null;
      }
      
      return question;
    });
  }
  
  // 处理singleChoiceAssessment
  if (assessment.singleChoiceAssessment && Array.isArray(assessment.singleChoiceAssessment)) {
    assessment.singleChoiceAssessment = assessment.singleChoiceAssessment.map(question => {
      if (!question) return question;
      
      if (Array.isArray(question.correctAnswer)) {
        question.correctAnswer = null;
      }
      
      return question;
    });
  }
  
  // 处理trueFalseAssessment
  if (assessment.trueFalseAssessment && Array.isArray(assessment.trueFalseAssessment)) {
    assessment.trueFalseAssessment = assessment.trueFalseAssessment.map(question => {
      if (!question) return question;
      
      if (Array.isArray(question.correctAnswer)) {
        question.correctAnswer = null;
      }
      
      return question;
    });
  }
  
  return assessment;
}

export function response(ctx) {
  const items = ctx.result.items || [];
  
  // 简单的内联数据转换，处理 DynamoDB 格式
  const transform = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    // 处理 DynamoDB 数据类型
    if (obj.S !== undefined) return obj.S;
    if (obj.N !== undefined) return parseInt(obj.N);
    if (obj.BOOL !== undefined) return obj.BOOL;
    if (obj.L !== undefined) return obj.L.map(item => transform(item));
    if (obj.M !== undefined) {
      const transformed = {};
      for (const [key, value] of Object.entries(obj.M)) {
        transformed[key] = transform(value);
      }
      return transformed;
    }
    
    // 处理普通对象
    if (Array.isArray(obj)) {
      return obj.map(item => transform(item));
    }
    
    const transformed = {};
    for (const [key, value] of Object.entries(obj)) {
      transformed[key] = transform(value);
    }
    return transformed;
  };
  
  // 对每个评估进行数据转换和清理
  const transformedItems = items.map(item => {
    const transformedItem = transform(item);
    return sanitizeAssessmentData(transformedItem);
  });
  
  return transformedItems;
}
