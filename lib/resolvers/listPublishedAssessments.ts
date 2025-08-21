// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'Scan',
    filter: {
      expression: 'published = :published',
      expressionValues: util.dynamodb.toMapValues({ ':published': true }),
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
      if (Array.isArray(question.title)) {
        question.title = question.title.join(' ') || null;
      }
      if (Array.isArray(question.question)) {
        question.question = question.question.join(' ') || null;
      }
      if (Array.isArray(question.explanation)) {
        question.explanation = question.explanation.join(' ') || null;
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
      if (Array.isArray(question.title)) {
        question.title = question.title.join(' ') || null;
      }
      if (Array.isArray(question.question)) {
        question.question = question.question.join(' ') || null;
      }
      if (Array.isArray(question.explanation)) {
        question.explanation = question.explanation.join(' ') || null;
      }
      
      return question;
    });
  }
  
  // 处理trueFalseAssessment
  if (assessment.trueFalseAssessment && Array.isArray(assessment.trueFalseAssessment)) {
    assessment.trueFalseAssessment = assessment.trueFalseAssessment.map(question => {
      if (!question) return question;
      
      if (Array.isArray(question.correctAnswer)) {
        question.correctAnswer = question.correctAnswer[0] || null;
      }
      if (Array.isArray(question.title)) {
        question.title = question.title.join(' ') || null;
      }
      if (Array.isArray(question.question)) {
        question.question = question.question.join(' ') || null;
      }
      if (Array.isArray(question.explanation)) {
        question.explanation = question.explanation.join(' ') || null;
      }
      
      return question;
    });
  }
  
  return assessment;
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  
  // 清理每个assessment
  const assessments = ctx.result.items || [];
  const cleanedAssessments = assessments.map(assessment => sanitizeAssessmentData(assessment));
  
  return cleanedAssessments;
}
