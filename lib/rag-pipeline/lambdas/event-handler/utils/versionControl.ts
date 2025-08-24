// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { S3Client, CopyObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { logger } from './pt';

const s3Client = new S3Client();

export interface VersionControlConfig {
  enableVersioning: boolean;
  maxVersions: number;
  archivePrefix: string;
}

export class DocumentVersionControl {
  private config: VersionControlConfig;

  constructor(config: VersionControlConfig = {
    enableVersioning: true,
    maxVersions: 5,
    archivePrefix: 'archive/versions/'
  }) {
    this.config = config;
  }

  /**
   * 处理文档更新时的版本控制
   * @param bucket S3存储桶名
   * @param key 文件键
   * @param userId 用户ID
   * @param courseId 课程ID
   */
  async handleDocumentUpdate(bucket: string, key: string, userId: string, courseId: string): Promise<void> {
    if (!this.config.enableVersioning) {
      logger.info('Version control disabled, skipping version creation');
      return;
    }

    try {
      // 检查文件是否已存在
      const exists = await this.checkObjectExists(bucket, key);
      if (!exists) {
        logger.info('File does not exist, no version control needed', { bucket, key });
        return;
      }

      // 创建版本备份
      await this.createVersionBackup(bucket, key, userId, courseId);

      // 清理旧版本
      await this.cleanupOldVersions(bucket, key, userId, courseId);

    } catch (error) {
      logger.error('Version control failed', { 
        error: error.message, 
        bucket, 
        key, 
        userId, 
        courseId,
        stack: error.stack 
      });
      // 不抛出错误，以免影响主流程
    }
  }

  /**
   * 检查对象是否存在
   */
  private async checkObjectExists(bucket: string, key: string): Promise<boolean> {
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * 创建版本备份
   */
  private async createVersionBackup(bucket: string, key: string, userId: string, courseId: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const versionKey = `${this.config.archivePrefix}${courseId}/${userId}/${timestamp}/${key}`;

    logger.info('Creating version backup', { 
      originalKey: key, 
      versionKey, 
      bucket 
    });

    const copyCommand = new CopyObjectCommand({
      CopySource: `${bucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}`,
      Bucket: bucket,
      Key: versionKey,
      MetadataDirective: 'COPY',
      TaggingDirective: 'COPY'
    });

    await s3Client.send(copyCommand);
    logger.info('Version backup created successfully', { versionKey });
  }

  /**
   * 清理旧版本（保留最新的N个版本）
   */
  private async cleanupOldVersions(bucket: string, key: string, userId: string, courseId: string): Promise<void> {
    try {
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      
      const versionPrefix = `${this.config.archivePrefix}${courseId}/${userId}/`;
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: versionPrefix,
        MaxKeys: 1000
      });

      const response = await s3Client.send(listCommand);
      if (!response.Contents || response.Contents.length <= this.config.maxVersions) {
        return;
      }

      // 按最后修改时间排序，删除最旧的版本
      const sortedVersions = response.Contents
        .filter(obj => obj.Key?.includes(key.split('/').pop() || ''))
        .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0));

      const versionsToDelete = sortedVersions.slice(this.config.maxVersions);

      for (const version of versionsToDelete) {
        if (version.Key) {
          logger.info('Deleting old version', { key: version.Key });
          await s3Client.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: version.Key
          }));
        }
      }

      logger.info('Cleanup completed', { 
        deletedVersions: versionsToDelete.length,
        remainingVersions: this.config.maxVersions
      });

    } catch (error) {
      logger.error('Failed to cleanup old versions', { 
        error: error.message,
        bucket,
        key,
        userId,
        courseId
      });
    }
  }

  /**
   * 获取文档的版本历史
   */
  async getVersionHistory(bucket: string, key: string, userId: string, courseId: string): Promise<Array<{
    versionKey: string;
    lastModified: Date;
    size: number;
  }>> {
    try {
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
      
      const versionPrefix = `${this.config.archivePrefix}${courseId}/${userId}/`;
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: versionPrefix,
        MaxKeys: 1000
      });

      const response = await s3Client.send(listCommand);
      if (!response.Contents) {
        return [];
      }

      const fileName = key.split('/').pop() || '';
      return response.Contents
        .filter(obj => obj.Key?.includes(fileName))
        .map(obj => ({
          versionKey: obj.Key!,
          lastModified: obj.LastModified!,
          size: obj.Size || 0
        }))
        .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

    } catch (error) {
      logger.error('Failed to get version history', { 
        error: error.message,
        bucket,
        key,
        userId,
        courseId
      });
      return [];
    }
  }

  /**
   * 恢复到指定版本
   */
  async restoreVersion(bucket: string, currentKey: string, versionKey: string): Promise<void> {
    try {
      logger.info('Restoring version', { currentKey, versionKey });

      const copyCommand = new CopyObjectCommand({
        CopySource: `${bucket}/${encodeURIComponent(versionKey).replace(/%2F/g, '/')}`,
        Bucket: bucket,
        Key: currentKey,
        MetadataDirective: 'COPY'
      });

      await s3Client.send(copyCommand);
      logger.info('Version restored successfully', { currentKey, versionKey });

    } catch (error) {
      logger.error('Failed to restore version', { 
        error: error.message,
        currentKey,
        versionKey
      });
      throw error;
    }
  }
}
