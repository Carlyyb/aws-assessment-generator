// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { S3Event, S3EventRecord, Context } from 'aws-lambda';
import { logger, tracer } from '../event-handler/utils/pt';
import { BedrockKnowledgeBase } from '../event-handler/kb/bedrockKnowledgeBase';
import { DocumentVersionControl } from '../event-handler/utils/versionControl';
import { extractPrefix } from '../event-handler/utils/extractPrefix';

const versionControl = new DocumentVersionControl({
  enableVersioning: process.env.ENABLE_VERSION_CONTROL === 'true',
  maxVersions: parseInt(process.env.MAX_VERSIONS || '5'),
  archivePrefix: process.env.ARCHIVE_PREFIX || 'archive/versions/'
});

class S3EventHandler implements LambdaInterface {
  /**
   * 处理S3事件（文件上传、删除、更新）
   */
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext({ logEvent: true })
  async handler(event: S3Event, lambdaContext: Context): Promise<void> {
    try {
      logger.info('S3 event received', { 
        recordCount: event.Records.length,
        records: event.Records.map(r => ({
          eventName: r.eventName,
          bucket: r.s3.bucket.name,
          key: r.s3.object.key
        }))
      });

      for (const record of event.Records) {
        await this.processS3Record(record);
      }

    } catch (error) {
      logger.error('S3 event handler error', { 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }

  private async processS3Record(record: S3EventRecord): Promise<void> {
    const eventName = record.eventName;
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    logger.info('Processing S3 record', { eventName, bucket, key });

    try {
      // 提取用户ID和课程ID从S3对象键
      const { userId, courseId } = this.extractMetadataFromKey(key);

      if (eventName.startsWith('ObjectCreated:')) {
        await this.handleObjectCreated(bucket, key, userId, courseId);
      } else if (eventName.startsWith('ObjectRemoved:')) {
        await this.handleObjectRemoved(bucket, key, userId, courseId);
      } else {
        logger.warn('Unsupported event type', { eventName });
      }

    } catch (error) {
      logger.error('Failed to process S3 record', { 
        error: error.message,
        eventName,
        bucket,
        key,
        stack: error.stack
      });
      // 不重新抛出错误，继续处理其他记录
    }
  }

  private async handleObjectCreated(bucket: string, key: string, userId: string, courseId: string): Promise<void> {
    logger.info('Handling object created', { bucket, key, userId, courseId });

    try {
      // 检查是否是更新操作（如果是更新，先进行版本控制）
      await versionControl.handleDocumentUpdate(bucket, key, userId, courseId);

      // 触发知识库同步
      await this.syncToKnowledgeBase(userId, courseId, key);

      logger.info('Object created processing completed', { bucket, key });

    } catch (error) {
      logger.error('Failed to handle object created', { 
        error: error.message,
        bucket,
        key,
        userId,
        courseId
      });
      throw error;
    }
  }

  private async handleObjectRemoved(bucket: string, key: string, userId: string, courseId: string): Promise<void> {
    logger.info('Handling object removed', { bucket, key, userId, courseId });

    try {
      // 从知识库中删除相关文档
      await this.removeFromKnowledgeBase(userId, courseId, key);

      logger.info('Object removed processing completed', { bucket, key });

    } catch (error) {
      logger.error('Failed to handle object removed', { 
        error: error.message,
        bucket,
        key,
        userId,
        courseId
      });
      throw error;
    }
  }

  private async syncToKnowledgeBase(userId: string, courseId: string, key: string): Promise<void> {
    try {
      logger.info('Starting knowledge base sync', { userId, courseId, key });

      const knowledgeBase = await BedrockKnowledgeBase.getKnowledgeBase(userId, courseId);
      const result = await knowledgeBase.ingestDocuments();

      logger.info('Knowledge base sync completed', { 
        ingestionJobId: result.ingestionJob?.ingestionJobId,
        status: result.ingestionJob?.status 
      });

    } catch (error) {
      logger.error('Knowledge base sync failed', { 
        error: error.message,
        userId,
        courseId,
        key
      });
      throw error;
    }
  }

  private async removeFromKnowledgeBase(userId: string, courseId: string, key: string): Promise<void> {
    try {
      logger.info('Removing from knowledge base', { userId, courseId, key });

      // 注意：Bedrock Knowledge Base 目前不支持单个文档删除
      // 需要重新同步整个数据源，或者直接操作向量数据库
      
      // 方案1：重新同步（简单但可能影响性能）
      const knowledgeBase = await BedrockKnowledgeBase.getKnowledgeBase(userId, courseId);
      const result = await knowledgeBase.ingestDocuments();

      logger.info('Knowledge base re-sync for deletion completed', { 
        ingestionJobId: result.ingestionJob?.ingestionJobId,
        status: result.ingestionJob?.status 
      });

      // 方案2：直接操作向量数据库（更高效，需要额外实现）
      // await this.deleteFromVectorStore(key);

    } catch (error) {
      logger.error('Failed to remove from knowledge base', { 
        error: error.message,
        userId,
        courseId,
        key
      });
      throw error;
    }
  }

  /**
   * 从S3对象键中提取用户ID和课程ID
   * 假设键格式为: uploads/knowledge-base/{courseId}/{userId}/{filename}
   */
  private extractMetadataFromKey(key: string): { userId: string; courseId: string } {
    const parts = key.split('/');
    
    // 根据您的S3键结构调整这个逻辑
    if (parts.length >= 4 && parts[0] === 'uploads' && parts[1] === 'knowledge-base') {
      return {
        courseId: parts[2],
        userId: parts[3]
      };
    }

    // 如果无法从键中提取，返回默认值或抛出错误
    logger.warn('Could not extract metadata from S3 key', { key });
    return {
      courseId: 'unknown',
      userId: 'unknown'
    };
  }
}

// The Lambda handler class.
const handlerClass = new S3EventHandler();

// The handler function.
export const handler = handlerClass.handler.bind(handlerClass);
