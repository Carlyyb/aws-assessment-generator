/**
 * 数据迁移脚本：将Assessment表中的lectureDate和deadline字段从AWSDate转换为AWSDateTime
 * 这个脚本将现有的日期字段转换为包含时间信息的datetime格式
 */

const AWS = require('aws-sdk');

// 配置AWS
const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-west-2'
});

const TABLE_NAME = 'GenAssessStack-DataStackNestedStackDataStackNestedStackResource8D986F6F-WZN8STT9JLUJ-AssessmentsTable6996196E-1JTSUQZSJTVXK';
// arn:aws:dynamodb:us-west-2:590771341960:table/GenAssessStack-DataStackNestedStackDataStackNestedStackResource8D986F6F-WZN8STT9JLUJ-AssessmentsTable6996196E-1JTSUQZSJTVXK

async function migrateAssessmentDatetime() {
  console.log('开始迁移Assessment表的datetime字段...');
  
  try {
    // 1. 扫描所有Assessment记录
    const scanParams = {
      TableName: TABLE_NAME
    };
    
    const result = await dynamodb.scan(scanParams).promise();
    const assessments = result.Items;
    
    console.log(`找到 ${assessments.length} 条Assessment记录需要迁移`);
    
    // 2. 批量更新记录
    let updatedCount = 0;
    
    for (const assessment of assessments) {
      let needsUpdate = false;
      const updateExpression = [];
      const expressionAttributeValues = {};
      
      // 检查lectureDate字段
      if (assessment.lectureDate && !assessment.lectureDate.includes('T')) {
        // 如果是日期格式（YYYY-MM-DD），转换为datetime格式
        const lectureDatetime = `${assessment.lectureDate}T09:00:00.000Z`;
        updateExpression.push('lectureDate = :lectureDate');
        expressionAttributeValues[':lectureDate'] = lectureDatetime;
        needsUpdate = true;
        console.log(`更新lectureDate: ${assessment.lectureDate} -> ${lectureDatetime}`);
      }
      
      // 检查deadline字段
      if (assessment.deadline && !assessment.deadline.includes('T')) {
        // 如果是日期格式（YYYY-MM-DD），转换为datetime格式
        const deadlineDatetime = `${assessment.deadline}T23:59:00.000Z`;
        updateExpression.push('deadline = :deadline');
        expressionAttributeValues[':deadline'] = deadlineDatetime;
        needsUpdate = true;
        console.log(`更新deadline: ${assessment.deadline} -> ${deadlineDatetime}`);
      }
      
      // 如果需要更新，执行更新操作
      if (needsUpdate) {
        const updateParams = {
          TableName: TABLE_NAME,
          Key: {
            userId: assessment.userId,  // 添加userId作为partition key
            id: assessment.id          // id作为sort key
          },
          UpdateExpression: `SET ${updateExpression.join(', ')}`,
          ExpressionAttributeValues: expressionAttributeValues
        };
         
        try {
          await dynamodb.update(updateParams).promise();
          updatedCount++;
          console.log(`已更新Assessment记录: ${assessment.id}`);
        } catch (error) {
          console.error(`更新Assessment记录失败: ${assessment.id}`, error);
        }
      }
    }
    
    console.log(`迁移完成！共更新了 ${updatedCount} 条记录`);
    
  } catch (error) {
    console.error('迁移过程中发生错误:', error);
    throw error;
  }
}

// 执行迁移
if (require.main === module) {
  migrateAssessmentDatetime()
    .then(() => {
      console.log('数据迁移成功完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('数据迁移失败:', error);
      process.exit(1);
    });
}

module.exports = { migrateAssessmentDatetime };
