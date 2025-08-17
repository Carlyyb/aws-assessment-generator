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

const MODEL_ID = 'us.amazon.nova-lite-v1:0';
const bedrock = new BedrockRuntime();
const bedrockAgentRuntime = new BedrockAgentRuntime();
const parser = new XMLParser();
const builder = new XMLBuilder();

export class GenAiService {
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
    logger.debug('Raw generated questions:', generatedQuestions);
    
    try {
      const parsedQuestions: GeneratedQuestions = parser.parse(generatedQuestions);
      logger.debug('Parsed questions structure:', JSON.stringify(parsedQuestions));
      
      let improvedQuestions: Array<MultiChoice | FreeText | TrueFalse | SingleChoice> = []; //CHANGELOG 2025-08-15 by 邱语堂：新增了单选/判断兼容
      
      // 检查解析结果的结构
      if (!parsedQuestions || !parsedQuestions.response || !parsedQuestions.response.questions) {
        logger.error('Invalid parsed questions structure', { parsedQuestions });
        throw new Error('Failed to parse questions: invalid structure');
      }
      
      const questions = Array.isArray(parsedQuestions.response.questions) 
        ? parsedQuestions.response.questions 
        : [parsedQuestions.response.questions];
      
      logger.info(`Processing ${questions.length} questions`);

      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        logger.debug(`Processing question ${i + 1}:`, JSON.stringify(question));
        
        const relevantDocs = await this.getRelevantDocuments(question);
        const improvedQuestion = await this.improveQuestion(assessmentTemplate, question, relevantDocs);
        improvedQuestions.push(improvedQuestion);
      }
      
      logger.info(`Successfully processed ${improvedQuestions.length} questions`);
      logger.debug('Final improved questions:', JSON.stringify(improvedQuestions));
      return Promise.resolve(improvedQuestions);
    } catch (error) {
      logger.error('Error in improveQuestions', { 
        error: error.message, 
        stack: error.stack,
        generatedQuestions: generatedQuestions.substring(0, 500) + '...' // 截断以避免日志过长
      });
      throw error;
    }
  }

  private async callLLM(modelId, prompt): Promise<string> {
    logger.debug(prompt);
    const body = JSON.stringify({
      messages: [
        {
          role: 'user',
          content: [
            {
              text: prompt,
            },
          ],
        },
      ],
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 0.7,
        topP: 0.9,
      },
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
    const contentElementElement = modelRes.output.message.content[0].text;

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
