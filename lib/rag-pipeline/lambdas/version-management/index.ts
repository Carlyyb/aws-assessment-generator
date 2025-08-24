// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { AppSyncResolverEvent, Context } from 'aws-lambda';
import { logger, tracer } from '../event-handler/utils/pt';
import { DocumentVersionControl } from '../event-handler/utils/versionControl';
import { AppSyncIdentityCognito } from 'aws-lambda/trigger/appsync-resolver';

const versionControl = new DocumentVersionControl({
  enableVersioning: process.env.ENABLE_VERSION_CONTROL === 'true',
  maxVersions: parseInt(process.env.MAX_VERSIONS || '5'),
  archivePrefix: process.env.ARCHIVE_PREFIX || 'archive/versions/'
});

interface VersionHistoryArgs {
  courseId: string;
  documentKey: string;
}

interface RestoreVersionArgs {
  courseId: string;
  documentKey: string;
  versionKey: string;
}

class VersionManagementLambda implements LambdaInterface {
  /**
   * 处理版本管理相关的GraphQL操作
   */
  @tracer.captureLambdaHandler()
  @logger.injectLambdaContext({ logEvent: true })
  async handler(event: AppSyncResolverEvent<any>, lambdaContext: Context): Promise<any> {
    try {
      const fieldName = event.info.fieldName;
      const identity = event.identity as AppSyncIdentityCognito;
      const userId = identity.sub;

      logger.info('Version management operation', { 
        fieldName, 
        userId, 
        arguments: event.arguments 
      });

      switch (fieldName) {
        case 'getDocumentVersionHistory':
          return await this.getVersionHistory(event.arguments as VersionHistoryArgs, userId);
        
        case 'restoreDocumentVersion':
          return await this.restoreVersion(event.arguments as RestoreVersionArgs, userId);
        
        default:
          throw new Error(`Unsupported field name: ${fieldName}`);
      }
    } catch (error) {
      logger.error('Version management handler error', { 
        error: error.message, 
        stack: error.stack 
      });
      throw error;
    }
  }

  private async getVersionHistory(args: VersionHistoryArgs, userId: string) {
    const { courseId, documentKey } = args;
    const bucket = process.env.KB_STAGING_BUCKET!;

    logger.info('Getting version history', { courseId, documentKey, userId });

    const versions = await versionControl.getVersionHistory(bucket, documentKey, userId, courseId);

    return {
      documentKey,
      courseId,
      versions: versions.map(v => ({
        versionKey: v.versionKey,
        lastModified: v.lastModified.toISOString(),
        size: v.size,
        timestamp: v.lastModified.toISOString()
      }))
    };
  }

  private async restoreVersion(args: RestoreVersionArgs, userId: string) {
    const { courseId, documentKey, versionKey } = args;
    const bucket = process.env.KB_STAGING_BUCKET!;

    logger.info('Restoring version', { courseId, documentKey, versionKey, userId });

    await versionControl.restoreVersion(bucket, documentKey, versionKey);

    return {
      success: true,
      message: 'Version restored successfully',
      documentKey,
      restoredFromVersion: versionKey
    };
  }
}

// The Lambda handler class.
const handlerClass = new VersionManagementLambda();

// The handler function.
export const handler = handlerClass.handler.bind(handlerClass);
