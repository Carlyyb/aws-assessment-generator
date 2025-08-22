// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { Context } from 'aws-lambda';
import { logger, tracer } from '../rag-pipeline/lambdas/event-handler/utils/pt';

interface TransformDataEvent {
  data: any;
}

class Lambda implements LambdaInterface {
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext({ logEvent: true })
  public async handler(event: TransformDataEvent, context: Context): Promise<any> {
    try {
      logger.info('Transforming DynamoDB data', { eventType: typeof event.data });
      
      const transformedData = this.transformDynamoDBData(event.data);
      
      logger.info('Data transformation completed successfully');
      return transformedData;
    } catch (error) {
      logger.error('Error transforming DynamoDB data', { error: error.message });
      throw error;
    }
  }

  /**
   * 转换 DynamoDB 原始格式数据为标准格式
   */
  private transformDynamoDBData(data: any): any {
    if (!data) return data;
    
    const transform = (obj: any): any => {
      if (!obj || typeof obj !== 'object') {
        return obj;
      }
      
      // 处理DynamoDB的数据类型格式
      if (obj.S !== undefined) return obj.S; // String
      if (obj.N !== undefined) return parseInt(obj.N); // Number
      if (obj.BOOL !== undefined) return obj.BOOL; // Boolean
      if (obj.L !== undefined) return obj.L.map((item: any) => transform(item)); // List
      if (obj.M !== undefined) { // Map
        const result: any = {};
        for (const [key, value] of Object.entries(obj.M)) {
          result[key] = transform(value);
        }
        return result;
      }
      
      // 处理普通对象
      if (Array.isArray(obj)) {
        return obj.map(item => transform(item));
      }
      
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = transform(value);
      }
      return result;
    };
    
    return transform(data);
  }

  /**
   * 清理评估数据，处理格式异常
   */
  private sanitizeAssessmentData(assessment: any): any {
    if (!assessment) return assessment;
    
    // 处理 multiChoiceAssessment
    if (assessment.multiChoiceAssessment && Array.isArray(assessment.multiChoiceAssessment)) {
      assessment.multiChoiceAssessment = assessment.multiChoiceAssessment.map((question: any) => {
        if (!question) return question;
        
        // 检查 correctAnswer 是否为数组，如果是则设为 null
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
    
    // 处理 singleChoiceAssessment
    if (assessment.singleChoiceAssessment && Array.isArray(assessment.singleChoiceAssessment)) {
      assessment.singleChoiceAssessment = assessment.singleChoiceAssessment.map((question: any) => {
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
    
    // 处理 trueFalseAssessment
    if (assessment.trueFalseAssessment && Array.isArray(assessment.trueFalseAssessment)) {
      assessment.trueFalseAssessment = assessment.trueFalseAssessment.map((question: any) => {
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
    
    // 处理 freeTextAssessment
    if (assessment.freeTextAssessment && Array.isArray(assessment.freeTextAssessment)) {
      assessment.freeTextAssessment = assessment.freeTextAssessment.map((question: any) => {
        if (!question) return question;
        
        if (Array.isArray(question.title)) {
          question.title = question.title.join(' ') || null;
        }
        if (Array.isArray(question.question)) {
          question.question = question.question.join(' ') || null;
        }
        
        return question;
      });
    }
    
    return assessment;
  }
}

// The Lambda handler class.
const handlerClass = new Lambda();

// The handler function.
export const handler = handlerClass.handler.bind(handlerClass);
