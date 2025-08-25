#!/usr/bin/env node

/**
 * 调试知识库创建流程的脚本
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// 实际的表名（从 AWS 查询获得）
const KB_TABLE = 'GenAssessStack-RagStackNestedStackRagStackNestedStackResourceE632B76F-H6HUID4BIWGY-KBTable3C212AC0-1K3IL15P3YPIR';

async function debugKnowledgeBase() {
  console.log('🔍 开始调试知识库创建流程...\n');
  
  try {
    // 1. 查看当前 KBTable 中的所有数据
    console.log('📋 查询 KBTable 中现有数据...');
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: KB_TABLE
      })
    );
    
    console.log(`📊 找到 ${scanResult.Items ? scanResult.Items.length : 0} 条记录:`);
    if (scanResult.Items && scanResult.Items.length > 0) {
      scanResult.Items.forEach((item, index) => {
        console.log(`   ${index + 1}. userId: ${item.userId}, courseId: ${item.courseId}, status: ${item.status}`);
        console.log(`      knowledgeBaseId: ${item.knowledgeBaseId}`);
        console.log(`      kbDataSourceId: ${item.kbDataSourceId}`);
        console.log('');
      });
    } else {
      console.log('   ❌ 表中没有任何数据\n');
    }
    
    // 2. 测试查询特定 courseId
    const testCourseId = 'test-course-id'; // 可以替换为实际的课程ID
    console.log(`🔍 测试查询课程 ID: ${testCourseId}`);
    
    const scanResponse = await docClient.send(
      new ScanCommand({
        TableName: KB_TABLE,
        FilterExpression: 'courseId = :courseId',
        ExpressionAttributeValues: {
          ':courseId': testCourseId
        }
      })
    );
    
    console.log(`📊 找到 ${scanResponse.Items ? scanResponse.Items.length : 0} 条匹配记录`);
    if (scanResponse.Items && scanResponse.Items.length > 0) {
      console.log('   ✅ 找到匹配的知识库记录');
    } else {
      console.log('   ❌ 没有找到匹配的知识库记录');
    }
    
    console.log('\n🔧 建议检查以下几点:');
    console.log('1. 确认创建知识库时是否成功写入了 DynamoDB 记录');
    console.log('2. 检查 Lambda 函数的环境变量 KB_TABLE 是否设置正确');
    console.log('3. 确认 Lambda 函数有 KBTable 的读写权限');
    console.log('4. 查看 CloudWatch 日志确认知识库创建过程');
    
  } catch (error) {
    console.error('❌ 调试过程中出现错误:', error.message);
    console.error('错误详情:', error);
    
    if (error.name === 'ResourceNotFoundException') {
      console.log('\n💡 建议: 检查表名是否正确，或者表是否已创建');
    }
  }
}

// 运行调试
if (require.main === module) {
  debugKnowledgeBase().catch(console.error);
}
