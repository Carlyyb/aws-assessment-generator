// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/*
 * Copyright (C) 2023 Amazon.com, Inc. or its affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { AppSyncResolverEvent, Context } from 'aws-lambda';
import { logger, tracer } from '../../../rag-pipeline/lambdas/event-handler/utils/pt';
import { ReferenceDocuments } from './models/referenceDocuments';
import { DataService } from './services/dataService';
import { GenAiService } from './services/genAiService';
import { GenerateAssessmentInput, GenerateAssessmentQueryVariables } from '../../../../ui/src/graphql/API';
import { AppSyncIdentityCognito } from 'aws-lambda/trigger/appsync-resolver';
import { GenerateAssessmentInput, MultiChoice, FreeText, TrueFalse, SingleChoice } from '../../../../../ui/src/graphql/API';

class WrappedAppSyncEvent {
  assessmentId: string;
  ctx: AppSyncResolverEvent<GenerateAssessmentQueryVariables>;
}

class Lambda implements LambdaInterface {
  knowledgeBaseId: string;
  private dataService: DataService;

  constructor() {
    this.dataService = new DataService();
  }

  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext({ logEvent: true })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async handler(event: WrappedAppSyncEvent, lambdaContext: Context): Promise<any> {
    let assessmentId = event.assessmentId;
    const ctx = event.ctx;
    const generateAssessmentInput = ctx.arguments.input;
    logger.info(generateAssessmentInput as any);

    const identity = ctx.identity as AppSyncIdentityCognito;
    const userId = identity.sub;

    if (!generateAssessmentInput) {
      throw new Error('Unable to process the request');
    }
    try {
      // 返回数组类型，兼容批量
      return await this.processEvent(generateAssessmentInput, userId, assessmentId);
    } catch (e) {
      // 批量失败处理
      if (Array.isArray(generateAssessmentInput.courseIds)) {
        for (const courseId of generateAssessmentInput.courseIds) {
          await this.dataService.updateFailedAssessment(userId, '');
        }
      } else {
        await this.dataService.updateFailedAssessment(userId, assessmentId);
      }
      throw e;
    }
  }

  private async processEvent(generateAssessmentInput: GenerateAssessmentInput, userId: string, assessmentId: string) {
    // CHANGELOG 2025-08-16 by 邱语堂: 支持批量处理多个课程，返回详细结果数组
    const results: Array<{ courseId: string; assessmentId: string; status: string }> = [];
    // 兼容单/多课程
    const courseIds = Array.isArray(generateAssessmentInput.courseIds)
      ? generateAssessmentInput.courseIds
      : [generateAssessmentInput.courseId];
    for (const courseId of courseIds) {
      try {
        // 构造单课程输入
        const singleInput = { ...generateAssessmentInput, courseId };
        const referenceDocuments = await ReferenceDocuments.fromRequest(singleInput, userId);
        this.knowledgeBaseId = referenceDocuments.knowledgeBaseId;
        const genAiService = new GenAiService(this.knowledgeBaseId);
        const topicsExtractionOutput = await genAiService.getTopics(referenceDocuments);
        const generatedQuestions = await genAiService.generateInitialQuestions(topicsExtractionOutput, referenceDocuments.assessmentTemplate);
        // 类型安全处理 improvedQuestions
        let improvedQuestions: MultiChoice[] | FreeText[] | TrueFalse[] | SingleChoice[] = [];
        switch (referenceDocuments.assessmentTemplate.assessType) {
          case 'multiChoiceAssessment':
            improvedQuestions = (await genAiService.improveQuestions(generatedQuestions, referenceDocuments.assessmentTemplate)) as MultiChoice[];
            break;
          case 'freeTextAssessment':
            improvedQuestions = (await genAiService.improveQuestions(generatedQuestions, referenceDocuments.assessmentTemplate)) as FreeText[];
            break;
          case 'trueFalseAssessment':
            improvedQuestions = (await genAiService.improveQuestions(generatedQuestions, referenceDocuments.assessmentTemplate)) as TrueFalse[];
            break;
          case 'singleChoiceAssessment':
            improvedQuestions = (await genAiService.improveQuestions(generatedQuestions, referenceDocuments.assessmentTemplate)) as SingleChoice[];
            break;
          default:
            improvedQuestions = [];
        }
        // 生成评估ID
        const assessmentId = await this.dataService.updateAssessment(improvedQuestions, userId, '');
        logger.info(`Assessment generated: ${assessmentId}`);
        results.push({ courseId, assessmentId, status: 'CREATED' });
      } catch (e) {
        logger.error(`Assessment for course ${courseId} failed: ${e}`);
        results.push({ courseId, assessmentId: '', status: 'FAILED' });
      }
    }
    return results;
  }
}

// The Lambda handler class.
const handlerClass = new Lambda();

// The handler function.
export const handler = handlerClass.handler.bind(handlerClass);
