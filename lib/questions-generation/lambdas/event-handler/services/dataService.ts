// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { v4 as uuidv4 } from 'uuid';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../../../rag-pipeline/lambdas/event-handler/utils/pt';
import { Assessment, AssessStatus, GenerateAssessmentInput, MultiChoice, FreeText, AssessType, TrueFalse, SingleAnswer } from '../../../../../ui/src/graphql/API';
import { AssessmentTemplate } from '../models/assessmentTemplate';
import { time } from 'console';

const ASSESSMENT_TABLE = process.env.ASSESSMENTS_TABLE;
const KB_TABLE = process.env.KB_TABLE;
const ASSESS_TEMPLATE_TABLE = process.env.ASSESS_TEMPLATE_TABLE;

export class DataService {
  private docClient: DynamoDBDocumentClient;

  constructor() {
    const client = new DynamoDBClient();
    this.docClient = DynamoDBDocumentClient.from(client);
  }

  async updateAssessment(improvedQuestions: MultiChoice[] | FreeText[] | TrueFalse[] | SingleAnswer[], userId: string, assessmentId: string) {
    const currentAssessment = await this.getExistingAssessment(userId, assessmentId);
    
    // 根据测试类型安全地分配问题数组
    switch (currentAssessment.assessType) {
      case 'multiChoiceAssessment':
        currentAssessment.multiChoiceAssessment = improvedQuestions as MultiChoice[];
        break;
      case 'freeTextAssessment':
        currentAssessment.freeTextAssessment = improvedQuestions as FreeText[];
        break;
      case 'trueFalseAssessment':
        currentAssessment.trueFalseAssessment = improvedQuestions as TrueFalse[];
        break;
      case 'singleAnswerAssessment':
        currentAssessment.singleAnswerAssessment = improvedQuestions as SingleAnswer[];
        break;
      default:
        throw new Error(`Unsupported assessment type: ${currentAssessment.assessType}`);
    }
    
    currentAssessment.status = AssessStatus.CREATED;
    currentAssessment.published = false;
    currentAssessment.updatedAt = new Date().toISOString();

    const command = new PutCommand({
      TableName: ASSESSMENT_TABLE,
      Item: currentAssessment,
    });

    logger.info(command as any);
    let ddbResponse = await this.docClient.send(command);
    logger.info(ddbResponse as any);
    return assessmentId;
  }

  async storeEmptyAssessment(assessmentInput: GenerateAssessmentInput, userId: string) {
    try {
      //Create UUID if it is not passed in
      const assessmentId = uuidv4();
      logger.info(`Storing empty assessment assessmentId: ${assessmentId}`, { userId, assessmentInput });

      let assessType = AssessType.trueFalseAssessment;
      
      if (assessmentInput.assessTemplateId) {
        try {
          const template = await this.getExistingAssessmentTemplate(assessmentInput.assessTemplateId, userId);
          assessType = template.assessType;
          logger.info(`Using template assessType: ${assessType}`, { templateId: assessmentInput.assessTemplateId });
        } catch (templateError) {
          logger.error(`Failed to get assessment template: ${templateError.message}`, { 
            templateId: assessmentInput.assessTemplateId, 
            userId 
          });
          throw new Error(`Assessment template not found or inaccessible: ${assessmentInput.assessTemplateId}`);
        }
      }

      const command = new PutCommand({
        TableName: ASSESSMENT_TABLE,
        Item: {
          name: assessmentInput.name,
          courseId: assessmentInput.courseId,
          lectureDate: assessmentInput.lectureDate,
          deadline: assessmentInput.deadline,
          userId: userId,
          id: assessmentId,
          assessType,
          status: AssessStatus.IN_PROGRESS,
          published: false,
          updatedAt: new Date().toISOString(),
          // 默认设置值
          timeLimited: false,           // 时间限制: 无限制
          timeLimit: '120',             // 时间限制: 120秒
          allowAnswerChange: true,      // 答案修改: 允许
          attemptLimit: 1,              // 测试次数: 1次
          studentGroups: ['ALL'],       // 学生分组: ALL
          courses: [],                  // 关联课程: []
          scoreMethod: 'highest',       // 计分方法: highest
        },
      });

      logger.info('Executing DynamoDB PutCommand', { command });
      let ddbResponse = await this.docClient.send(command);
      logger.info('DynamoDB PutCommand successful', { response: ddbResponse });
      
      return assessmentId;
    } catch (error) {
      logger.error('Error in storeEmptyAssessment', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async getExistingAssessment(userId: string, assessmentId: string): Promise<Assessment> {
    // noinspection TypeScriptValidateTypes
    const command = new GetCommand({
      Key: {
        userId: userId,
        id: assessmentId,
      },
      TableName: ASSESSMENT_TABLE,
    });
    logger.info(command as any);
    let ddbResponse = await this.docClient.send(command);

    logger.info(ddbResponse as any);
    return ddbResponse.Item as Assessment;
  }

  async getExistingKnowledgeBase(courseId: string, userId: string) {
    // noinspection TypeScriptValidateTypes
    const command = new GetCommand({
      Key: {
        userId: userId,
        courseId: courseId,
      },
      TableName: KB_TABLE,
    });
    logger.info(command as any);
    let ddbResponse = await this.docClient.send(command);

    logger.info(ddbResponse as any);
    if (ddbResponse.Item) {
      return ddbResponse.Item;
    }

    // 兼容共享知识库：如果按用户查不到，按课程ID全表扫描一次
    try {
      logger.info('KB not found for user, scanning by courseId', { courseId });
      const scan = new ScanCommand({
        TableName: KB_TABLE,
        FilterExpression: 'courseId = :courseId',
        ExpressionAttributeValues: {
          ':courseId': courseId,
        },
        Limit: 1,
      });
      const scanResp = await this.docClient.send(scan);
      logger.info('KB scan result', { count: scanResp.Count });
      if (scanResp.Items && scanResp.Items.length > 0) {
        return scanResp.Items[0];
      }
    } catch (e) {
      logger.error('Error scanning KB table by courseId', { error: (e as any).message });
    }

    return undefined;
  }

  async getExistingAssessmentTemplate(assessTemplateId: string, userId: string): Promise<AssessmentTemplate> {
    // 首先尝试用当前用户ID查询
    let command = new GetCommand({
      Key: {
        userId: userId,
        id: assessTemplateId,
      },
      TableName: ASSESS_TEMPLATE_TABLE,
    });
    logger.info('Trying to get template with current user', { command, assessTemplateId, userId });
    let ddbResponse = await this.docClient.send(command);

    logger.info('Template query result', { response: ddbResponse });
    
    let assessTemplate = ddbResponse.Item as AssessmentTemplate;
    
    // 如果用当前用户ID找不到测试模板，尝试扫描表找到该测试模板
    if (!assessTemplate) {
      logger.info('Template not found for current user, scanning all templates', { assessTemplateId });
      
      try {
        const scanCommand = new ScanCommand({
          TableName: ASSESS_TEMPLATE_TABLE,
          FilterExpression: 'id = :templateId',
          ExpressionAttributeValues: {
            ':templateId': assessTemplateId
          }
        });
        
        const scanResult = await this.docClient.send(scanCommand);
        
        if (scanResult.Items && scanResult.Items.length > 0) {
          assessTemplate = scanResult.Items[0] as AssessmentTemplate;
          logger.info('Found template from scan', { assessTemplate });
        }
      } catch (scanError) {
        logger.error('Error scanning for template', { error: scanError.message, assessTemplateId });
      }
    }
    
    if (!assessTemplate) {
      throw new Error(`Assessment template ${assessTemplateId} not found`);
    }
    
    // 注意：这里移除了用户权限检查，因为现在所有用户都能使用所有测试模板
    // 如果需要恢复权限检查，可以取消注释下面的代码：
    // if (assessTemplate.userId !== userId) {
    //   throw new Error(`User ${userId} does not have permission to access template ${assessTemplateId}`);
    // }
    
    return assessTemplate;
  }

  async updateFailedAssessment(userId: string, assessmentId: string) {
    const command = new UpdateCommand({
      Key: {
        userId: userId,
        id: assessmentId,
      },
      UpdateExpression: 'set #st=:status, updatedAt=:updatedAt',
      ExpressionAttributeNames: {
        '#st': 'status',
      },
      ExpressionAttributeValues: {
        ':status': AssessStatus.FAILED,
        ':updatedAt': new Date().toISOString(),
      },
      TableName: ASSESSMENT_TABLE,
    });
    logger.info(command as any);
    let ddbResponse = await this.docClient.send(command);
    logger.info(ddbResponse as any);
    return assessmentId;
  }
}
