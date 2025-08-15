// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { logger } from '../../../../rag-pipeline/lambdas/event-handler/utils/pt';
import { ReferenceDocuments } from '../models/referenceDocuments';
import { AssessmentTemplate } from '../models/assessmentTemplate';
import { GeneratedQuestions } from '../models/generatedQuestions';
import { BedrockAgentRuntime, KnowledgeBaseRetrievalResult } from '@aws-sdk/client-bedrock-agent-runtime';
import { BedrockRuntime } from '@aws-sdk/client-bedrock-runtime';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { MultiChoice, FreeText, TrueFalse, SingleChoice } from '../../../../../ui/src/graphql/API'; //CHANGELOG 2025-08-15 by 邱语堂：新增了单选/判断

import { getInitialQuestionsPrompt, getRelevantDocumentsPrompt, getTopicsPrompt, improveQuestionPrompt } from './prompts';

const MODEL_ID = 'amazon.nova-lite-v1:0';
const bedrock = new BedrockRuntime();
const bedrockAgentRuntime = new BedrockAgentRuntime();
const parser = new XMLParser();
const builder = new XMLBuilder();

export class GenAiService {
  /**
   * 批量为多个课程生成评估
   * @param courseIds 课程ID数组
   * @param topicsExtractionOutput 主题抽取结果
   * @param assessmentTemplate 评估模板
   * @returns 所有课程的评估结果数组
   * CHANGELOG 2025-08-16 by 邱语堂: 新增批量生成评估方法
   */
  public async generateAssessmentsForCourses(courseIds: string[], topicsExtractionOutput: string, assessmentTemplate: AssessmentTemplate) {
    const results: Array<{ courseId: string; questions: any }> = [];
    for (const courseId of courseIds) {
      // 可根据实际业务传递 courseId 到 prompt 或其它参数
      // 这里假设每个课程都用同样的 topicsExtractionOutput 和 assessmentTemplate
      const prompt = getInitialQuestionsPrompt(assessmentTemplate, topicsExtractionOutput);
      const llmResponse = await this.callLLM(MODEL_ID, prompt);
      // 可根据实际业务解析 llmResponse
      results.push({ courseId, questions: llmResponse });
    }
    return results;
  }
  private knowledgeBaseId: string;

  constructor(knowledgeBaseId: string) {
    this.knowledgeBaseId = knowledgeBaseId;
  }

  public async getTopics(referenceDocuments: ReferenceDocuments) {
    let prompt = getTopicsPrompt(referenceDocuments);
    logger.debug(prompt);
    let llmResponse = await this.callLLM(MODEL_ID, prompt);
    logger.debug(llmResponse);
    return llmResponse;
  }

  public async generateInitialQuestions(topicsExtractionOutput: string, assessmentTemplate: AssessmentTemplate) {
    let prompt = getInitialQuestionsPrompt(assessmentTemplate, topicsExtractionOutput);
    logger.debug(prompt);
    const llmResponse = await this.callLLM(MODEL_ID, prompt);
    logger.debug(llmResponse);
    return llmResponse;
  }

  public async getRelevantDocuments(question: MultiChoice | FreeText | TrueFalse | SingleChoice) {//CHANGELOG 2025-08-15 by 邱语堂：新增了单选/判断兼容
    //logger.info(question as any);

    const kbQuery = getRelevantDocumentsPrompt(question);
    logger.debug(`KB query: ${kbQuery}`);
    const retrievedDocs = await bedrockAgentRuntime.retrieve({
      knowledgeBaseId: this.knowledgeBaseId,
      retrievalQuery: {
        text: kbQuery.substring(0, 1000), // limit to 1000 chars
      },
    });
    const retrievalResults = retrievedDocs.retrievalResults;
    logger.debug(retrievedDocs as any);
    return retrievalResults;
  }

  public async improveQuestions(generatedQuestions: string, assessmentTemplate: AssessmentTemplate) {
    logger.debug(generatedQuestions);
    const parsedQuestions: GeneratedQuestions = parser.parse(generatedQuestions);
    let improvedQuestions: Array<MultiChoice | FreeText | TrueFalse | SingleChoice> = []; //CHANGELOG 2025-08-15 by 邱语堂：新增了单选/判断兼容
    logger.debug(JSON.stringify(parsedQuestions));

    for (let i = 0; i < parsedQuestions.response.questions.length; i++) {
      const question = parsedQuestions.response.questions[i];
      const relevantDocs = await this.getRelevantDocuments(question);
      const improvedQuestion = await this.improveQuestion(assessmentTemplate, question, relevantDocs);
      improvedQuestions.push(improvedQuestion);
    }
    logger.debug(JSON.stringify(improvedQuestions));
    return Promise.resolve(improvedQuestions);
  }

  private async callLLM(modelId, prompt): Promise<string> {
    logger.debug(prompt);
    const body = JSON.stringify({
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }],
        },
      ],
    });
    const response = await bedrock.invokeModel({
      body: body,
      modelId: modelId,
      accept: 'application/json',
      contentType: 'application/json',
    });

    //TODO find out what Types we should expect
    const text = response.body.transformToString();
    //logger.info(text);
    const modelRes = JSON.parse(text);
    const contentElementElement = modelRes.content[0]['text'];

    return contentElementElement;
  }

  private async improveQuestion(
    assessmentTemplate: AssessmentTemplate,
    originalQuestion: MultiChoice | FreeText | TrueFalse | SingleChoice,    //CHANGELOG 2025-08-15 by 邱语堂：新增了单选/判断兼容
    relevantDocs: KnowledgeBaseRetrievalResult[] | undefined
  ): Promise<MultiChoice | FreeText | TrueFalse | SingleChoice> {   //CHANGELOG 2025-08-15 by 邱语堂：新增了单选/判断兼容
    if (!(relevantDocs && relevantDocs.length > 0)) {
      return originalQuestion;
    }

    logger.info(originalQuestion as any);
    const xmlQuestion = builder.build(originalQuestion);
    logger.info(xmlQuestion as any);
    const xmlDocs = builder.build(relevantDocs);
    logger.info(xmlDocs as any);
    let prompt = improveQuestionPrompt(xmlQuestion, xmlDocs, assessmentTemplate);

    logger.debug(prompt);
    const llmResponse = await this.callLLM(MODEL_ID, prompt);
    logger.debug(llmResponse);
    const { question }: { question: MultiChoice | FreeText | TrueFalse | SingleChoice } = parser.parse(llmResponse);    //CHANGELOG 2025-08-15 by 邱语堂：新增了单选/判断兼容
    return question;
  }
}
