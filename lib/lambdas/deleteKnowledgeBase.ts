import {
  BedrockAgentClient,
  DeleteKnowledgeBaseCommand,
  DeleteDataSourceCommand,
  GetKnowledgeBaseCommand,
  ListDataSourcesCommand,
} from '@aws-sdk/client-bedrock-agent';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const bedrockAgentClient = new BedrockAgentClient();
const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client();

const KB_TABLE = process.env.KB_TABLE;
const KB_STAGING_BUCKET = process.env.KB_STAGING_BUCKET;

interface KnowledgeBaseRecord {
  userId: string;
  courseId: string;
  knowledgeBaseId: string;
  kbDataSourceId: string;
  s3prefix: string;
  indexName: string;
  status: string;
}

export const handler = async (event: any) => {
  console.log('删除知识库事件:', JSON.stringify(event, null, 2));
  
  const { courseId } = event.arguments;
  
  if (!courseId) {
    throw new Error('课程ID是必需的');
  }
  
  try {
    // 1. 查找该课程对应的知识库记录
    const scanResponse = await docClient.send(
      new ScanCommand({
        TableName: KB_TABLE,
        FilterExpression: 'courseId = :courseId',
        ExpressionAttributeValues: {
          ':courseId': courseId
        }
      })
    );

    if (!scanResponse.Items || scanResponse.Items.length === 0) {
      console.log(`课程 ${courseId} 没有关联的知识库记录`);
      return {
        success: true,
        message: '没有找到需要删除的知识库'
      };
    }

    const knowledgeBaseRecord = scanResponse.Items[0] as KnowledgeBaseRecord;
    const { knowledgeBaseId, kbDataSourceId, s3prefix, userId } = knowledgeBaseRecord;

    console.log(`找到知识库记录:`, {
      knowledgeBaseId,
      kbDataSourceId,
      s3prefix,
      courseId
    });

    // 2. 删除S3中的文件
    if (s3prefix && KB_STAGING_BUCKET) {
      try {
        console.log(`正在删除S3文件，前缀: ${s3prefix}`);
        
        // 列出所有匹配前缀的文件
        const listObjectsResponse = await s3Client.send(new ListObjectsV2Command({
          Bucket: KB_STAGING_BUCKET,
          Prefix: s3prefix
        }));

        if (listObjectsResponse.Contents && listObjectsResponse.Contents.length > 0) {
          // 删除所有文件
          const deletePromises = listObjectsResponse.Contents.map(object => {
            if (object.Key) {
              console.log(`删除S3文件: ${object.Key}`);
              return s3Client.send(new DeleteObjectCommand({
                Bucket: KB_STAGING_BUCKET,
                Key: object.Key
              }));
            }
            return Promise.resolve();
          });

          await Promise.all(deletePromises);
          console.log(`成功删除了 ${listObjectsResponse.Contents.length} 个S3文件`);
        } else {
          console.log('没有找到需要删除的S3文件');
        }
      } catch (s3Error) {
        console.error('删除S3文件失败:', s3Error);
        // S3删除失败不应该阻止知识库删除，继续执行
      }
    }

    // 3. 删除Bedrock数据源
    if (kbDataSourceId) {
      try {
        console.log(`正在删除数据源: ${kbDataSourceId}`);
        await bedrockAgentClient.send(new DeleteDataSourceCommand({
          knowledgeBaseId,
          dataSourceId: kbDataSourceId
        }));
        console.log('数据源删除成功');
      } catch (dsError: any) {
        console.error('删除数据源失败:', dsError);
        // 如果数据源已经不存在，不抛出错误
        if (!dsError.message.includes('does not exist') && !dsError.message.includes('not found')) {
          throw new Error(`删除数据源失败: ${dsError.message}`);
        }
        console.log('数据源可能已经被删除或不存在');
      }
    }

    // 4. 删除Bedrock知识库
    try {
      console.log(`正在删除知识库: ${knowledgeBaseId}`);
      
      // 先检查知识库是否存在
      try {
        await bedrockAgentClient.send(new GetKnowledgeBaseCommand({
          knowledgeBaseId
        }));
        
        // 如果存在，则删除
        await bedrockAgentClient.send(new DeleteKnowledgeBaseCommand({
          knowledgeBaseId
        }));
        console.log('知识库删除成功');
      } catch (getError: any) {
        if (getError.message.includes('does not exist') || getError.message.includes('not found')) {
          console.log('知识库已经不存在');
        } else {
          throw getError;
        }
      }
    } catch (kbError: any) {
      console.error('删除知识库失败:', kbError);
      throw new Error(`删除知识库失败: ${kbError.message}`);
    }

    // 5. 删除DynamoDB记录
    try {
      console.log(`正在删除DynamoDB记录: userId=${userId}, courseId=${courseId}`);
      await docClient.send(new DeleteCommand({
        TableName: KB_TABLE,
        Key: {
          userId,
          courseId
        }
      }));
      console.log('DynamoDB记录删除成功');
    } catch (dbError) {
      console.error('删除DynamoDB记录失败:', dbError);
      throw new Error(`删除DynamoDB记录失败: ${dbError}`);
    }

    console.log(`课程 ${courseId} 的知识库清理完成`);
    return {
      success: true,
      message: '知识库删除成功',
      details: {
        knowledgeBaseId,
        dataSourceId: kbDataSourceId,
        s3prefix,
        courseId
      }
    };

  } catch (error: any) {
    console.error('删除知识库过程中发生错误:', error);
    throw new Error(`删除知识库失败: ${error.message}`);
  }
};
