// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { v4 as uuidv4 } from 'uuid';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../../../rag-pipeline/lambdas/event-handler/utils/pt';
import { Assessment, AssessStatus, GenerateAssessmentInput, MultiChoice, FreeText, TrueFalse, SingleChoice, AssessType } from '../../../../../ui/src/graphql/API';
import { AssessmentTemplate } from '../models/assessmentTemplate';

const ASSESSMENT_TABLE = process.env.ASSESSMENTS_TABLE;
const KB_TABLE = process.env.KB_TABLE;
const ASSESS_TEMPLATE_TABLE = process.env.ASSESS_TEMPLATE_TABLE;

export class DataService {
  /**
   * 批量为多个课程存储空评估
   * @param assessmentInput 评估输入（包含 courseIds 数组）
   * @param userId 用户ID
   * @returns 所有评估ID数组
   * CHANGELOG 2025-08-16 by 邱语堂: 新增批量存储评估方法
   */
  async storeEmptyAssessmentsForCourses(assessmentInput: any, userId: string) {
     const ids: string[] = [];
     if (!assessmentInput.courseIds || !Array.isArray(assessmentInput.courseIds)) {
       throw new Error('courseIds 必须为数组');
     }
     for (const courseId of assessmentInput.courseIds) {
       const singleInput = { ...assessmentInput, courseId };
       const id = await this.storeEmptyAssessment(singleInput, userId);
       ids.push(id);
     }
     return ids;
  }
  private docClient: DynamoDBDocumentClient;

  constructor() {
    const client = new DynamoDBClient();
    this.docClient = DynamoDBDocumentClient.from(client);
  }

  async updateAssessment(
    improvedQuestions: MultiChoice[] | FreeText[] | TrueFalse[] | SingleChoice[],
    userId: string,
    assessmentId: string
  ) {
    const currentAssessment = await this.getExistingAssessment(userId, assessmentId);
    // CHANGELOG 2025-08-16 by 邱语堂: 支持多题型数组赋值
    switch (currentAssessment.assessType) {
      case AssessType.multiChoiceAssessment:
        currentAssessment.multiChoiceAssessment = Array.isArray(improvedQuestions) && improvedQuestions.length > 0 && 'answerChoices' in improvedQuestions[0] && typeof improvedQuestions[0].correctAnswer === 'number'
          ? (improvedQuestions as MultiChoice[])
          : [];
        break;
      case AssessType.freeTextAssessment:
        currentAssessment.freeTextAssessment = Array.isArray(improvedQuestions) && improvedQuestions.length > 0 && 'rubric' in improvedQuestions[0]
          ? (improvedQuestions as FreeText[])
          : [];
        break;
      case AssessType.trueFalseAssessment:
        currentAssessment.trueFalseAssessment = Array.isArray(improvedQuestions) && improvedQuestions.length > 0 && 'answerChoices' in improvedQuestions[0] && typeof improvedQuestions[0].correctAnswer === 'string'
          ? (improvedQuestions as TrueFalse[])
          : [];
        break;
      case AssessType.singleChoiceAssessment:
        currentAssessment.singleChoiceAssessment = Array.isArray(improvedQuestions) && improvedQuestions.length > 0 && 'answerChoices' in improvedQuestions[0] && improvedQuestions[0].answerChoices?.length === 4
          ? (improvedQuestions as SingleChoice[])
          : [];
        break;
      default:
        // 可选：抛出异常或忽略
        break;
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
    //Create UUID if it is not passed in
    const assessmentId = uuidv4();
    logger.info(`Storing empty assessment assessmentId: ${assessmentId}`);

    const assessType = assessmentInput.assessTemplateId
      ? (await this.getExistingAssessmentTemplate(assessmentInput.assessTemplateId, userId)).assessType
      : AssessType.multiChoiceAssessment;

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
      },
    });

    logger.info(command as any);
    let ddbResponse = await this.docClient.send(command);
    logger.info(ddbResponse as any);
    return assessmentId;
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
    return ddbResponse.Item;
  }

  async getExistingAssessmentTemplate(assessTemplateId: string, userId: string): Promise<AssessmentTemplate> {
    // noinspection TypeScriptValidateTypes
    const command = new GetCommand({
      Key: {
        userId: userId,
        id: assessTemplateId,
      },
      TableName: ASSESS_TEMPLATE_TABLE,
    });
    logger.info(command as any);
    let ddbResponse = await this.docClient.send(command);

    logger.info(ddbResponse as any);
    return ddbResponse.Item as AssessmentTemplate;
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
