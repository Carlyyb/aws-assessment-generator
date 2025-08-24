// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import {
  BedrockAgentClient,
  GetKnowledgeBaseCommand,
  CreateDataSourceCommand,
  CreateDataSourceResponse,
  CreateKnowledgeBaseCommand,
  CreateKnowledgeBaseCommandInput,
  CreateKnowledgeBaseResponse,
  StartIngestionJobCommand,
  StartIngestionJobCommandOutput,
  GetIngestionJobCommand,
  ValidationException,
  KnowledgeBaseStatus,
  IngestionJobStatus,
} from '@aws-sdk/client-bedrock-agent';
import { logger } from '../utils/pt';
import { VectorStore } from './vectorStore';
import { defaultRetryHandler } from '../utils/retryHandler';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const bedrockAgentClient = new BedrockAgentClient();
const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);
const KB_TABLE = process.env.KB_TABLE;

export class BedrockKnowledgeBase {
  private readonly knowledgeBaseId: string;
  private readonly dataSourceId: string;

  constructor(knowledgeBaseId: string, kbDataSourceId: string) {
    this.knowledgeBaseId = knowledgeBaseId;
    this.dataSourceId = kbDataSourceId;
  }

  static async getKnowledgeBase(userId: string, courseId: string): Promise<BedrockKnowledgeBase> {
    // 首先尝试查找该课程的任何现有知识库（不限制用户）
    const scanResponse = await docClient.send(
      new ScanCommand({
        TableName: KB_TABLE,
        FilterExpression: 'courseId = :courseId',
        ExpressionAttributeValues: {
          ':courseId': courseId
        }
      })
    );

    // 如果找到现有的知识库，返回它（不管是哪个教师创建的）
    if (scanResponse.Items && scanResponse.Items.length > 0) {
      const existingKB = scanResponse.Items[0];
      logger.info('Found existing KB for course', existingKB as any);
      return new BedrockKnowledgeBase(existingKB['knowledgeBaseId'], existingKB['kbDataSourceId']);
    }

    // 如果没有找到现有知识库，创建新的
    const kbName = `${courseId}-shared`; // 移除用户ID，使其为共享知识库
    const s3prefix = `shared/${courseId}/`; // 使用共享前缀
    const kbDataSourceName = `${kbName}-datasource`;

    // The Knowledge Base does not exist
    logger.info(`KnowledgeBase for course ${courseId} does not exist, creating shared KB`);
    const vectorStore = await VectorStore.getVectorStore(kbName);
    let knowledgeBaseId = await BedrockKnowledgeBase.createKnowledgeBase(kbName, vectorStore.indexName);
    await this.waitForKbReady(knowledgeBaseId);
    let kbDataSourceId = await BedrockKnowledgeBase.createDataSource(knowledgeBaseId, kbDataSourceName, s3prefix);

    // 将知识库记录存储到 DynamoDB（使用当前用户ID，但这是为了保持表结构一致性）
    const storeKBResponse = await docClient.send(
      new PutCommand({
        TableName: KB_TABLE,
        Item: {
          userId, // 记录创建者，但所有教师都可以访问
          courseId,
          knowledgeBaseId,
          kbDataSourceId,
          indexName: vectorStore.indexName,
          s3prefix,
          status: 'ACTIVE',
        },
      })
    );

    return new BedrockKnowledgeBase(knowledgeBaseId, kbDataSourceId);
  }

  private static async createDataSource(knowledgeBaseId: string, kbDataSourceName: string, s3prefix: string): Promise<string> {
    //Create datasource
    const createDataSourceCommand = new CreateDataSourceCommand({
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: `arn:aws:s3:::${process.env.KB_STAGING_BUCKET}`,
          inclusionPrefixes: [s3prefix],
        },
      },
      vectorIngestionConfiguration: {
        chunkingConfiguration: {
          chunkingStrategy: 'FIXED_SIZE',
          fixedSizeChunkingConfiguration: {
            maxTokens: 512,
            overlapPercentage: 20,
          },
        },
      },
      knowledgeBaseId: knowledgeBaseId,
      name: kbDataSourceName,
    });

    // noinspection TypeScriptValidateTypes
    let createDSResponse: CreateDataSourceResponse = await bedrockAgentClient.send(createDataSourceCommand);
    logger.info('DataSource created', createDSResponse as any);

    if (!(createDSResponse.dataSource && createDSResponse.dataSource.dataSourceId)) {
      throw new Error('dataSourceId was not present in the response');
    }

    return createDSResponse.dataSource.dataSourceId;
  }

  private static async createKnowledgeBase(kbName: string, vectorIndexName: string) {
    const createKbRequest = new CreateKnowledgeBaseCommand({
      name: kbName,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: `arn:aws:bedrock:${process.env.AWS_REGION}::foundation-model/amazon.titan-embed-text-v1`,
        },
      },
      roleArn: process.env.BEDROCK_ROLE_ARN,
      storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS',
        opensearchServerlessConfiguration: {
          collectionArn: process.env.OPSS_COLLECTION_ARN,
          vectorIndexName: vectorIndexName,
          fieldMapping: {
            vectorField: 'vector',
            textField: 'text',
            metadataField: 'text-metadata',
          },
        },
      },
    });

    const createKbResponse = await this.createKBWithRetry(createKbRequest);
    // noinspection TypeScriptValidateTypes
    logger.info('KB Created', { response: createKbResponse });

    if (!(createKbResponse.knowledgeBase && createKbResponse.knowledgeBase.knowledgeBaseId)) {
      throw new Error('KB id not present in the response');
    }

    return createKbResponse.knowledgeBase.knowledgeBaseId;
  }

  private static async createKBWithRetry(createKbRequest: CreateKnowledgeBaseCommand): Promise<CreateKnowledgeBaseResponse> {
    const MAX_ATTEMPTS = 3;
    const WAIT_MS = 5000;
    let attempts = 0;
    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      try {
        // noinspection TypeScriptValidateTypes
        logger.info(`Attempt ${attempts}. KB creating`, { request: createKbRequest });
        // noinspection TypeScriptValidateTypes
        const createKbResponse = await bedrockAgentClient.send(createKbRequest);
        return createKbResponse;
      } catch (e) {
        logger.info(e);
        if (e instanceof ValidationException && e.message.includes('no such index')) {
          logger.info('Index still creating, wait and retry');
          await new Promise((resolve) => {
            return setTimeout(resolve, WAIT_MS);
          });
        } else {
          //non-retryable error
          throw e;
        }
      }
    }
    throw new Error(`Unable to create KB after ${MAX_ATTEMPTS} attempts`);
  }

  async ingestDocuments() {
    //Start ingestion into KB
    const ingestionInput = {
      dataSourceId: this.dataSourceId,
      knowledgeBaseId: this.knowledgeBaseId,
    };
    logger.info('Start document ingestion', ingestionInput as any);

    const startIngestionResponse: StartIngestionJobCommandOutput = await defaultRetryHandler.executeWithRetry(
      async () => {
        const startIngestionJobCommand = new StartIngestionJobCommand(ingestionInput);
        return await bedrockAgentClient.send(startIngestionJobCommand);
      },
      'startIngestionJob',
      ingestionInput
    );

    logger.info(startIngestionResponse as any);
    
    // 验证响应结构
    if (!startIngestionResponse.ingestionJob) {
      throw new Error('Invalid ingestion response: missing ingestionJob');
    }
    
    if (!startIngestionResponse.ingestionJob.ingestionJobId) {
      throw new Error('Invalid ingestion response: missing ingestionJobId');
    }
    
    if (!startIngestionResponse.ingestionJob.knowledgeBaseId) {
      throw new Error('Invalid ingestion response: missing knowledgeBaseId');
    }
    
    if (!startIngestionResponse.ingestionJob.dataSourceId) {
      throw new Error('Invalid ingestion response: missing dataSourceId');
    }
    
    return startIngestionResponse;
  }

  private async waitForIngestion(knowledgeBaseId: string, dataSourceId: string, ingestionJobId: string) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const response = await bedrockAgentClient.send(new GetIngestionJobCommand({ knowledgeBaseId, dataSourceId, ingestionJobId }));
    logger.info(response as any);
    const jobStatus = response.ingestionJob?.status;
    if (jobStatus === IngestionJobStatus.FAILED) throw new Error('Ingestion job failed');
    if (jobStatus !== IngestionJobStatus.COMPLETE) await this.waitForIngestion(knowledgeBaseId, dataSourceId, ingestionJobId);
  }

  private static async waitForKbReady(knowledgeBaseId: string) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const response = await bedrockAgentClient.send(new GetKnowledgeBaseCommand({ knowledgeBaseId }));
    const kbStatus = response.knowledgeBase?.status;
    if (kbStatus === KnowledgeBaseStatus.FAILED) throw new Error('KB creation failed');
    if (kbStatus === KnowledgeBaseStatus.CREATING) await this.waitForKbReady(knowledgeBaseId);
  }
}
