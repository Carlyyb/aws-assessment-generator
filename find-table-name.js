#!/usr/bin/env node

/**
 * 快速获取 DynamoDB 表名的工具脚本
 */

const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { CloudFormationClient, DescribeStacksCommand } = require('@aws-sdk/client-cloudformation');

async function findAssessTemplateTable() {
  console.log('🔍 正在查找 AssessTemplatesTable...\n');

  // 方法1: 通过 DynamoDB 列表查找
  try {
    console.log('📋 方法1: 扫描 DynamoDB 表列表...');
    const dynamoClient = new DynamoDBClient({});
    const listResult = await dynamoClient.send(new ListTablesCommand({}));
    
    const templateTables = listResult.TableNames.filter(name => 
      name.includes('AssessTemplate') || name.includes('assesstemplate')
    );
    
    if (templateTables.length > 0) {
      console.log('✅ 找到以下候选表:');
      templateTables.forEach((table, index) => {
        console.log(`   ${index + 1}. ${table}`);
      });
      
      if (templateTables.length === 1) {
        console.log(`\n💡 建议使用: ${templateTables[0]}`);
        console.log(`💻 设置环境变量: export ASSESS_TEMPLATE_TABLE="${templateTables[0]}"`);
      }
    } else {
      console.log('❌ 未找到 AssessTemplate 相关的表');
    }
  } catch (error) {
    console.error('❌ DynamoDB 扫描失败:', error.message);
  }

  // 方法2: 通过 CloudFormation 查找
  try {
    console.log('\n📋 方法2: 查询 CloudFormation 堆栈...');
    const cfClient = new CloudFormationClient({});
    
    // 尝试常见的堆栈名
    const stackNames = ['GenAssessStack', 'gen-assess-stack', 'GenAssess'];
    
    for (const stackName of stackNames) {
      try {
        const stackResult = await cfClient.send(new DescribeStacksCommand({
          StackName: stackName
        }));
        
        console.log(`✅ 找到堆栈: ${stackName}`);
        
        // 查找输出中的表名
        const outputs = stackResult.Stacks[0].Outputs || [];
        const tableOutputs = outputs.filter(output => 
          output.OutputKey && output.OutputKey.toLowerCase().includes('template')
        );
        
        if (tableOutputs.length > 0) {
          console.log('📋 相关输出:');
          tableOutputs.forEach(output => {
            console.log(`   ${output.OutputKey}: ${output.OutputValue}`);
          });
        }
        
        break;
      } catch (err) {
        // 继续尝试下一个堆栈名
      }
    }
  } catch (error) {
    console.error('❌ CloudFormation 查询失败:', error.message);
  }

  console.log('\n💡 如果仍然找不到表名，请尝试:');
  console.log('   1. 检查 AWS 控制台 > CloudFormation > GenAssessStack > 资源');
  console.log('   2. 检查 AWS 控制台 > DynamoDB > 表');
  console.log('   3. 运行: aws dynamodb list-tables');
}

// 运行
if (require.main === module) {
  findAssessTemplateTable().catch(console.error);
}
