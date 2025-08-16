// 数据迁移脚本：为现有的知识库记录添加status字段
// 运行此脚本来修复现有的DynamoDB记录

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

// 配置AWS客户端
const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

// 请根据您的实际表名修改这个值
const KB_TABLE_NAME = process.env.KB_TABLE || 'KBTable'; // 请确认正确的表名

async function updateKnowledgeBaseRecords() {
  console.log('开始扫描知识库表...');
  
  try {
    // 扫描所有记录
    const scanResult = await docClient.send(new ScanCommand({
      TableName: KB_TABLE_NAME
    }));
    
    console.log(`找到 ${scanResult.Items?.length || 0} 条记录`);
    
    if (!scanResult.Items || scanResult.Items.length === 0) {
      console.log('没有找到任何记录需要更新');
      return;
    }
    
    // 更新缺少status字段的记录
    let updatedCount = 0;
    for (const item of scanResult.Items) {
      if (!item.status) {
        console.log(`更新记录: userId=${item.userId}, courseId=${item.courseId}`);
        
        // 为记录添加status字段
        const updatedItem = {
          ...item,
          status: 'ACTIVE'
        };
        
        await docClient.send(new PutCommand({
          TableName: KB_TABLE_NAME,
          Item: updatedItem
        }));
        
        updatedCount++;
      }
    }
    
    console.log(`成功更新了 ${updatedCount} 条记录`);
    console.log('数据迁移完成！');
    
  } catch (error) {
    console.error('迁移过程中出现错误:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  updateKnowledgeBaseRecords();
}

module.exports = { updateKnowledgeBaseRecords };
