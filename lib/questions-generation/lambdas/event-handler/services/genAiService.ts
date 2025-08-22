// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { logger } from '../../../../rag-pipeline/lambdas/event-handler/utils/pt';
import { ReferenceDocuments } from '../models/referenceDocuments';
import { AssessmentTemplate } from '../models/assessmentTemplate';
import { GeneratedQuestions } from '../models/generatedQuestions';
import { BedrockAgentRuntime, KnowledgeBaseRetrievalResult } from '@aws-sdk/client-bedrock-agent-runtime';
import { BedrockRuntime } from '@aws-sdk/client-bedrock-runtime';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { MultiChoice, FreeText, TrueFalse, SingleAnswer, AssessType } from '../../../../../ui/src/graphql/API'; //CHANGELOG 2025-08-15 by 邱语堂：新增了单选/判断

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

  public async getTopics(referenceDocuments: ReferenceDocuments, customPrompt?: string) {
    let prompt = getTopicsPrompt(referenceDocuments, customPrompt);
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

  public async getRelevantDocuments(question: MultiChoice | FreeText | TrueFalse | SingleAnswer) {//CHANGELOG 2025-08-15 by 邱语堂：新增了单选/判断兼容
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
      
      let improvedQuestions: Array<MultiChoice | FreeText | TrueFalse | SingleAnswer> = []; //CHANGELOG 2025-08-15 by 邱语堂：新增了单选/判断兼容
      
      // 检查解析结果的结构
      if (!parsedQuestions || !parsedQuestions.response || !parsedQuestions.response.questions) {
        logger.error('Invalid parsed questions structure', { parsedQuestions });
        throw new Error('Failed to parse questions: invalid structure');
      }
      
      const questions = Array.isArray(parsedQuestions.response.questions) 
        ? parsedQuestions.response.questions 
        : [parsedQuestions.response.questions];
      
      // 预处理问题，修复correctAnswer类型问题
      questions.forEach((question, index) => {
        if ((assessmentTemplate.assessType === AssessType.multiChoiceAssessment || 
             assessmentTemplate.assessType === AssessType.singleAnswerAssessment) && 
            question && 'correctAnswer' in question) {
          
          logger.debug(`Processing correctAnswer for question ${index + 1}:`, { 
            originalAnswer: question.correctAnswer, 
            type: typeof question.correctAnswer 
          });
          
          // 处理各种可能的AI输出格式
          const originalAnswer = question.correctAnswer;
          const convertedAnswer = this.convertAnswerToNumber(question.correctAnswer);
          (question as any).correctAnswer = convertedAnswer;
          logger.debug(`Converted answer: ${JSON.stringify(originalAnswer)} -> ${convertedAnswer}`);
        }
        
        // 同样处理TrueFalse题型
        if (assessmentTemplate.assessType === AssessType.trueFalseAssessment && 
            question && 'correctAnswer' in question) {
          
          logger.debug(`Processing TrueFalse correctAnswer for question ${index + 1}:`, { 
            originalAnswer: question.correctAnswer, 
            type: typeof question.correctAnswer 
          });
          
          // TrueFalse题型的特殊处理
          const originalAnswer = question.correctAnswer;
          const tfAnswer = this.convertTrueFalseAnswer(question.correctAnswer);
          (question as any).correctAnswer = tfAnswer;
          logger.debug(`Converted TrueFalse answer: ${JSON.stringify(originalAnswer)} -> ${tfAnswer}`);
        }
      });
      
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
              correctAnswer: this.convertAnswerToNumber(correctAnswers[j]),
              explanation: typeof explanations[j] === 'object' ? (explanations[j] as any).text : explanations[j]
            } as MultiChoice;
            
            logger.debug(`Created individual question ${j + 1}:`, {
              title: individualQuestion.title,
              correctAnswer: individualQuestion.correctAnswer,
              originalCorrectAnswer: correctAnswers[j]
            });
            
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

  /**
   * 将各种可能的AI输出转换为数字索引
   * 处理以下情况：
   * - 数字: 1, 2, 3, 4
   * - 字符串数字: "1", "2", "3", "4"
   * - 字母选项: "A", "B", "C", "D"
   * - 数组: ["A"], [1], ["1"] (取第一个元素)
   * - 复合对象: {text: "A"}, {value: 1} 等
   * A=1, B=2, C=3, D=4
   */
  private convertAnswerToNumber(answer: any): number {
    logger.debug(`Converting answer to number:`, { answer, type: typeof answer });
    
    // 处理null或undefined
    if (answer == null) {
      logger.warn(`Answer is null or undefined, defaulting to 1`);
      return 1;
    }
    
    // 处理数组类型 - AI可能返回数组
    if (Array.isArray(answer)) {
      if (answer.length === 0) {
        logger.warn(`Answer array is empty, defaulting to 1`);
        return 1;
      }
      // 递归处理数组的第一个元素
      return this.convertAnswerToNumber(answer[0]);
    }
    
    // 处理对象类型 - AI可能返回复杂对象
    if (typeof answer === 'object') {
      // 尝试常见的对象属性
      if ('text' in answer) {
        return this.convertAnswerToNumber(answer.text);
      }
      if ('value' in answer) {
        return this.convertAnswerToNumber(answer.value);
      }
      if ('answer' in answer) {
        return this.convertAnswerToNumber(answer.answer);
      }
      // 如果是普通对象，尝试转换为字符串
      const answerStr = String(answer);
      logger.warn(`Converting object to string: ${answerStr}`);
      return this.convertAnswerToNumber(answerStr);
    }
    
    // 处理数字类型
    if (typeof answer === 'number') {
      // 确保数字在有效范围内
      if (answer >= 1 && answer <= 4 && Number.isInteger(answer)) {
        return answer;
      }
      logger.warn(`Number ${answer} is out of valid range (1-4), defaulting to 1`);
      return 1;
    }
    
    // 处理字符串类型
    if (typeof answer === 'string') {
      const trimmedAnswer = answer.trim();
      
      // 处理空字符串
      if (trimmedAnswer === '') {
        logger.warn(`Answer string is empty, defaulting to 1`);
        return 1;
      }
      
      // 尝试直接解析数字
      const numericValue = parseInt(trimmedAnswer, 10);
      if (!isNaN(numericValue) && numericValue >= 1 && numericValue <= 4) {
        return numericValue;
      }
      
      // 处理字母选项（不区分大小写）
      const upperAnswer = trimmedAnswer.toUpperCase();
      switch (upperAnswer) {
        case 'A':
        case 'OPTION A':
        case '选项A':
          return 1;
        case 'B':
        case 'OPTION B':
        case '选项B':
          return 2;
        case 'C':
        case 'OPTION C':
        case '选项C':
          return 3;
        case 'D':
        case 'OPTION D':
        case '选项D':
          return 4;
        default:
          // 尝试从字符串中提取字母或数字
          const letterMatch = upperAnswer.match(/[ABCD]/);
          if (letterMatch) {
            const letter = letterMatch[0];
            logger.info(`Extracted letter '${letter}' from string '${answer}'`);
            return this.convertAnswerToNumber(letter);
          }
          
          const numberMatch = trimmedAnswer.match(/[1-4]/);
          if (numberMatch) {
            const number = parseInt(numberMatch[0], 10);
            logger.info(`Extracted number '${number}' from string '${answer}'`);
            return number;
          }
          
          logger.warn(`Could not parse answer format: '${answer}', defaulting to 1`);
          return 1;
      }
    }
    
    // 处理布尔类型（虽然不太可能，但为了完整性）
    if (typeof answer === 'boolean') {
      logger.warn(`Answer is boolean (${answer}), converting to number: ${answer ? 1 : 2}`);
      return answer ? 1 : 2;
    }
    
    // 兜底处理
    logger.warn(`Unexpected answer type: ${typeof answer}, value: ${JSON.stringify(answer)}, defaulting to 1`);
    return 1;
  }

  /**
   * 转换True/False答案为字符串
   * 处理AI可能返回的各种True/False格式
   */
  private convertTrueFalseAnswer(answer: any): string {
    logger.debug(`Converting TrueFalse answer:`, { answer, type: typeof answer });
    
    // 处理null或undefined
    if (answer == null) {
      logger.warn(`TrueFalse answer is null or undefined, defaulting to 'True'`);
      return 'True';
    }
    
    // 处理数组类型
    if (Array.isArray(answer)) {
      if (answer.length === 0) {
        logger.warn(`TrueFalse answer array is empty, defaulting to 'True'`);
        return 'True';
      }
      return this.convertTrueFalseAnswer(answer[0]);
    }
    
    // 处理对象类型
    if (typeof answer === 'object') {
      if ('text' in answer) {
        return this.convertTrueFalseAnswer(answer.text);
      }
      if ('value' in answer) {
        return this.convertTrueFalseAnswer(answer.value);
      }
      const answerStr = String(answer);
      return this.convertTrueFalseAnswer(answerStr);
    }
    
    // 处理布尔类型
    if (typeof answer === 'boolean') {
      return answer ? 'True' : 'False';
    }
    
    // 处理数字类型
    if (typeof answer === 'number') {
      // 1或正数表示True，0或负数表示False
      return answer > 0 ? 'True' : 'False';
    }
    
    // 处理字符串类型
    if (typeof answer === 'string') {
      const trimmedAnswer = answer.trim().toLowerCase();
      
      // 处理常见的True表示
      if (trimmedAnswer === 'true' || 
          trimmedAnswer === 't' || 
          trimmedAnswer === 'yes' || 
          trimmedAnswer === 'y' || 
          trimmedAnswer === '1' ||
          trimmedAnswer === '正确' ||
          trimmedAnswer === '是') {
        return 'True';
      }
      
      // 处理常见的False表示
      if (trimmedAnswer === 'false' || 
          trimmedAnswer === 'f' || 
          trimmedAnswer === 'no' || 
          trimmedAnswer === 'n' || 
          trimmedAnswer === '0' ||
          trimmedAnswer === '错误' ||
          trimmedAnswer === '否') {
        return 'False';
      }
      
      // 如果包含true关键字
      if (trimmedAnswer.includes('true') || trimmedAnswer.includes('正确')) {
        return 'True';
      }
      
      // 如果包含false关键字
      if (trimmedAnswer.includes('false') || trimmedAnswer.includes('错误')) {
        return 'False';
      }
      
      logger.warn(`Could not parse TrueFalse answer: '${answer}', defaulting to 'True'`);
      return 'True';
    }
    
    logger.warn(`Unexpected TrueFalse answer type: ${typeof answer}, value: ${JSON.stringify(answer)}, defaulting to 'True'`);
    return 'True';
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

    // 解析AI响应并确保类型安全
    const text = response.body.transformToString();
    //logger.info(text);
    const modelRes = JSON.parse(text);
    const contentElementElement = modelRes.output.message.content[0].text;

    return contentElementElement;
  }

  private async improveQuestion(
    assessmentTemplate: AssessmentTemplate,
    originalQuestion: MultiChoice | FreeText | TrueFalse | SingleAnswer,    //CHANGELOG 2025-08-15 by 邱语堂：新增了单选/判断兼容
    relevantDocs: KnowledgeBaseRetrievalResult[] | undefined
  ): Promise<MultiChoice | FreeText | TrueFalse | SingleAnswer> {   //CHANGELOG 2025-08-15 by 邱语堂：新增了单选/判断兼容
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
    const { question }: { question: MultiChoice | FreeText | TrueFalse | SingleAnswer } = parser.parse(llmResponse);    //CHANGELOG 2025-08-15 by 邱语堂：新增了单选/判断兼容
    
    // 修复多选题的correctAnswer类型问题
    if ((assessmentTemplate.assessType === AssessType.multiChoiceAssessment || 
         assessmentTemplate.assessType === AssessType.singleAnswerAssessment) && 
        question && 'correctAnswer' in question) {
      (question as MultiChoice | SingleAnswer).correctAnswer = this.convertAnswerToNumber((question as MultiChoice | SingleAnswer).correctAnswer);
    }
    
    return question;
  }
}
