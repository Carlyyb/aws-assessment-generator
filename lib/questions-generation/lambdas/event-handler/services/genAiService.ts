// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { logger } from '../../../../rag-pipeline/lambdas/event-handler/utils/pt';
import { ReferenceDocuments } from '../models/referenceDocuments';
import { AssessmentTemplate } from '../models/assessmentTemplate';
import { GeneratedQuestions } from '../models/generatedQuestions';
import { BedrockAgentRuntime, KnowledgeBaseRetrievalResult } from '@aws-sdk/client-bedrock-agent-runtime';
import { BedrockRuntime } from '@aws-sdk/client-bedrock-runtime';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { MultiChoice, FreeText, TrueFalse, SingleChoice, AssessType } from '../../../../../ui/src/graphql/API'; //CHANGELOG 2025-08-15 by 邱语堂：新增了单选/判断

import { getInitialQuestionsPrompt, getRelevantDocumentsPrompt, getTopicsPrompt, improveQuestionPrompt } from './prompts';

const MODEL_ID = 'us.amazon.nova-lite-v1:0';
const bedrock = new BedrockRuntime();
const bedrockAgentRuntime = new BedrockAgentRuntime();
const parser = new XMLParser({
  isArray: (name, jpath, isLeafNode, isAttribute) => {
    // Only treat 'questions' as array, not individual question properties
    return jpath === 'response.questions';
  }
});
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
        
        // 检查是否是合并的问题结构（包含数组的question, correctAnswer等）
        if (assessmentTemplate.assessType === AssessType.multiChoiceAssessment && 
            Array.isArray((question as MultiChoice).question) &&
            Array.isArray((question as MultiChoice).correctAnswer)) {
          
          logger.info('Detected merged question structure, splitting into individual questions');
          const mergedQuestion = question as MultiChoice;
          const questionTexts = Array.isArray(mergedQuestion.question) ? mergedQuestion.question : [mergedQuestion.question];
          const correctAnswers = Array.isArray(mergedQuestion.correctAnswer) ? mergedQuestion.correctAnswer : [mergedQuestion.correctAnswer];
          const explanations = Array.isArray(mergedQuestion.explanation) ? mergedQuestion.explanation : [mergedQuestion.explanation];
          
          // 检查生成的内容是否包含XML/技术内容
          const hasXmlContent = questionTexts.some(q => {
            const questionText = typeof q === 'object' ? (q as any).text : q;
            return questionText && (
              questionText.toLowerCase().includes('xml') ||
              questionText.toLowerCase().includes('document.xml') ||
              questionText.toLowerCase().includes('theme.xml') ||
              questionText.toLowerCase().includes('.rels')
            );
          });
          
          if (hasXmlContent) {
            logger.error('Generated questions contain XML/technical content instead of educational content');
            throw new Error('Generated questions contain technical document references instead of educational content. Please check your knowledge base documents.');
          }
          
          // 为每个子问题创建单独的问题对象
          for (let j = 0; j < questionTexts.length; j++) {
            const individualQuestion = {
              __typename: "MultiChoice" as const,
              title: `${mergedQuestion.title} - Part ${j + 1}`,
              question: typeof questionTexts[j] === 'object' ? (questionTexts[j] as any).text : questionTexts[j],
              answerChoices: mergedQuestion.answerChoices,
              correctAnswer: correctAnswers[j],
              explanation: typeof explanations[j] === 'object' ? (explanations[j] as any).text : explanations[j]
            } as MultiChoice;
            
            const relevantDocs = await this.getRelevantDocuments(individualQuestion);
            const improvedQuestion = await this.improveQuestion(assessmentTemplate, individualQuestion, relevantDocs);
            improvedQuestions.push(improvedQuestion);
          }
        } else {
          // 正常的单个问题处理 - 也检查XML内容
          const questionText = (question as any).question;
          if (questionText && (
            questionText.toLowerCase().includes('xml') ||
            questionText.toLowerCase().includes('document.xml') ||
            questionText.toLowerCase().includes('theme.xml') ||
            questionText.toLowerCase().includes('.rels')
          )) {
            logger.error('Generated question contains XML/technical content instead of educational content');
            logger.error('Question text:', questionText);
            throw new Error('Generated questions contain technical document references instead of educational content. Please check your knowledge base documents.');
          }
          
          const relevantDocs = await this.getRelevantDocuments(question);
          const improvedQuestion = await this.improveQuestion(assessmentTemplate, question, relevantDocs);
          improvedQuestions.push(improvedQuestion);
        }
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
