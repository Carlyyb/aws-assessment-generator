// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
import { AssessmentTemplate } from "./assessmentTemplate";
import { GetObjectCommand, GetObjectCommandOutput, S3Client } from "@aws-sdk/client-s3";
import { GenerateAssessmentInput } from "../../../../../ui/src/graphql/API";
import { logger } from "../../../../rag-pipeline/lambdas/event-handler/utils/pt";
import { DataService } from "../services/dataService";


const s3Client = new S3Client();
const dataService = new DataService();

export class ReferenceDocuments {
  private static SOURCE_BUCKET = process.env.Q_GENERATION_BUCKET;
  documentsContent: string[];
  assessmentTemplate: AssessmentTemplate;
  knowledgeBaseId: string;

  constructor(documentsContent: string[], assessmentTemplate: AssessmentTemplate, knowledgeBaseId) {
    this.documentsContent = documentsContent;
    this.assessmentTemplate = assessmentTemplate;
    this.knowledgeBaseId = knowledgeBaseId;
  }

  static async fromRequest(generateAssessmentInput: GenerateAssessmentInput, userId: string) {
    const documents = generateAssessmentInput.locations || [];
    const assessmentTemplateId = generateAssessmentInput.assessTemplateId || undefined;
    const kbRecord = await dataService.getExistingKnowledgeBase(generateAssessmentInput.courseId, userId);
    if (!kbRecord || !kbRecord.knowledgeBaseId) {
      // 提前给出明确错误，而不是在解构时抛出类型错误
      throw new Error('No knowledge base found for this course. Please create the course knowledge base before generating assessments.');
    }
    const { knowledgeBaseId } = kbRecord as { knowledgeBaseId: string };
    logger.info(`Using knowledgeBaseId: ${knowledgeBaseId}`);

    let documentsContent: string[] = [];
    
    // 只有当提供了文档位置时才处理文档
    if (documents && documents.length > 0) {
      documentsContent = await Promise.all(documents.map(async (s3ObjectKey) => {
        if (s3ObjectKey == null) {
          return;
        }
        const getObjectCommandParams = {
          Bucket: this.SOURCE_BUCKET,
          Key: `public/${s3ObjectKey}`,
        };
        logger.info(`Getting Object ${s3ObjectKey}`, getObjectCommandParams as any);
        const s3response: GetObjectCommandOutput = await s3Client.send(new GetObjectCommand(getObjectCommandParams));
        const document = await s3response.Body?.transformToString();
        if (!document) {
          throw new Error(`Empty object: ${s3ObjectKey}`);
        }
        
        // 添加文档内容调试信息
        logger.info(`Document ${s3ObjectKey} length: ${document.length}`);
        logger.debug(`Document ${s3ObjectKey} preview (first 500 chars): ${document.substring(0, 500)}`);
        
        // 检查是否包含XML内容（可能表示读取了错误的文档）
        if (document.includes('<?xml') || document.includes('<document>') || document.includes('xmlns:')) {
          logger.warn(`Document ${s3ObjectKey} appears to contain XML content, may not be educational material`);
        }
        
        return document;
      }));
      
      // 过滤掉undefined的文档
      documentsContent = documentsContent.filter(doc => doc !== undefined) as string[];
    }

    // 如果既没有文档也没有自定义prompt，抛出错误
    if ((!documentsContent || documentsContent.length === 0) && !generateAssessmentInput.customPrompt?.trim()) {
      throw new Error("At least one document or a custom prompt is required for assessment generation");
    }

    const assessmentTemplate = await AssessmentTemplate.fromId(assessmentTemplateId, userId);
    return new ReferenceDocuments(documentsContent, assessmentTemplate, knowledgeBaseId);
  }
}