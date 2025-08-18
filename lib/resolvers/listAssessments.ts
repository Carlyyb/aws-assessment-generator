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
  
  // 对每个assessment进行数据清理
  const sanitizedItems = items.map(item => {
    return sanitizeAssessmentData(item);
  });
  
  return sanitizedItems;
}
