#!/usr/bin/env node

/**
 * 测试删除知识库功能
 * 运行方式: node test-delete-knowledge-base.js
 */

const AWS = require('aws-sdk');

// AWS配置
const region = process.env.AWS_REGION || 'us-west-2';
const graphqlUrl = 'https://6a4dv7m5mzeytkykiobz6jhs2e.appsync-api.us-west-2.amazonaws.com/graphql';

// 配置AWS SDK
AWS.config.update({ region });

const cognitoIdp = new AWS.CognitoIdentityServiceProvider();
const appsync = new AWS.AppSync();

// 测试用户凭证
const testUser = {
  username: 'testuser@example.com',
  password: 'TempPassword123!',
  userPoolId: 'us-west-2_GHJwO6Szz',
  clientId: '1ntdpka2jsus9vrtqa3lfhd3v5'
};

async function getAccessToken() {
  try {
    const authResult = await cognitoIdp.adminInitiateAuth({
      UserPoolId: testUser.userPoolId,
      ClientId: testUser.clientId,
      AuthFlow: 'ADMIN_NO_SRP_AUTH',
      AuthParameters: {
        USERNAME: testUser.username,
        PASSWORD: testUser.password
      }
    }).promise();

    return authResult.AuthenticationResult.AccessToken;
  } catch (error) {
    console.error('认证失败:', error);
    throw error;
  }
}

async function testDeleteKnowledgeBase(courseId) {
  const accessToken = await getAccessToken();
  
  const mutation = \`
    mutation DeleteKnowledgeBase($courseId: ID!) {
      deleteKnowledgeBase(courseId: $courseId) {
        success
        message
        details {
          knowledgeBaseId
          dataSourceId
          s3prefix
          courseId
        }
      }
    }
  \`;

  const variables = {
    courseId: courseId
  };

  try {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': accessToken
      },
      body: JSON.stringify({
        query: mutation,
        variables: variables
      })
    });

    const result = await response.json();
    
    if (result.errors) {
      console.error('GraphQL错误:', JSON.stringify(result.errors, null, 2));
      return;
    }

    console.log('删除知识库结果:', JSON.stringify(result.data.deleteKnowledgeBase, null, 2));
    
    if (result.data.deleteKnowledgeBase.success) {
      console.log('✅ 知识库删除成功');
    } else {
      console.log('❌ 知识库删除失败:', result.data.deleteKnowledgeBase.message);
    }

  } catch (error) {
    console.error('请求失败:', error);
  }
}

async function testDeleteCourse(courseId) {
  const accessToken = await getAccessToken();
  
  const mutation = \`
    mutation DeleteCourse($id: ID!) {
      deleteCourse(id: $id)
    }
  \`;

  const variables = {
    id: courseId
  };

  try {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': accessToken
      },
      body: JSON.stringify({
        query: mutation,
        variables: variables
      })
    });

    const result = await response.json();
    
    if (result.errors) {
      console.error('GraphQL错误:', JSON.stringify(result.errors, null, 2));
      return;
    }

    console.log('删除课程结果:', result.data.deleteCourse);
    
    if (result.data.deleteCourse) {
      console.log('✅ 课程删除成功（应同时删除关联的知识库）');
    } else {
      console.log('❌ 课程删除失败');
    }

  } catch (error) {
    console.error('请求失败:', error);
  }
}

async function listCourses() {
  const accessToken = await getAccessToken();
  
  const query = \`
    query ListCourses {
      listCourses {
        id
        name
        description
      }
    }
  \`;

  try {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': accessToken
      },
      body: JSON.stringify({
        query: query
      })
    });

    const result = await response.json();
    
    if (result.errors) {
      console.error('GraphQL错误:', JSON.stringify(result.errors, null, 2));
      return [];
    }

    return result.data.listCourses || [];

  } catch (error) {
    console.error('请求失败:', error);
    return [];
  }
}

async function main() {
  try {
    console.log('🔍 获取课程列表...');
    const courses = await listCourses();
    
    if (courses.length === 0) {
      console.log('❌ 没有找到任何课程');
      return;
    }

    console.log('📚 找到的课程:');
    courses.forEach((course, index) => {
      console.log(\`  \${index + 1}. \${course.name} (ID: \${course.id})\`);
    });

    // 测试第一个课程
    const testCourse = courses[0];
    console.log(\`\\n🧪 测试课程: \${testCourse.name} (ID: \${testCourse.id})\`);

    console.log('\\n🗑️ 测试删除知识库...');
    await testDeleteKnowledgeBase(testCourse.id);

    console.log('\\n⏳ 等待3秒...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\\n🗑️ 测试删除课程（应自动删除知识库）...');
    await testDeleteCourse(testCourse.id);

  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 检查是否需要 fetch polyfill (Node.js < 18)
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

main();

// 表名（根据实际情况修改）
const KB_TABLE_NAME = process.env.KB_TABLE || 'GenAssessStack-RagStackNestedStackRagStackNestedStackResourceE632B76F-1XR4FTEXQQVSG-KBTable3C212AC0-W6SXBVRR4MSM';

async function testDeleteKnowledgeBase() {
  const courseId = process.argv[2];
  
  if (!courseId) {
    console.error('使用方法: node test-delete-knowledge-base.js <courseId>');
    process.exit(1);
  }
  
  console.log(`测试删除课程 ${courseId} 的知识库...`);
  
  try {
    // 1. 查询该课程是否有知识库
    console.log('1. 查询知识库记录...');
    const scanResponse = await docClient.send(
      new ScanCommand({
        TableName: KB_TABLE_NAME,
        FilterExpression: 'courseId = :courseId',
        ExpressionAttributeValues: {
          ':courseId': courseId
        }
      })
    );

    if (!scanResponse.Items || scanResponse.Items.length === 0) {
      console.log(`❌ 课程 ${courseId} 没有关联的知识库记录`);
      return;
    }

    const knowledgeBaseRecord = scanResponse.Items[0];
    console.log('✅ 找到知识库记录:');
    console.log(`   - 知识库ID: ${knowledgeBaseRecord.knowledgeBaseId}`);
    console.log(`   - 数据源ID: ${knowledgeBaseRecord.kbDataSourceId}`);
    console.log(`   - S3前缀: ${knowledgeBaseRecord.s3prefix}`);
    console.log(`   - 用户ID: ${knowledgeBaseRecord.userId}`);
    console.log(`   - 状态: ${knowledgeBaseRecord.status}`);
    
    // 模拟删除流程说明
    console.log('\n2. 删除流程说明:');
    console.log('   ✓ 删除S3文件 (前缀: ' + knowledgeBaseRecord.s3prefix + ')');
    console.log('   ✓ 删除Bedrock数据源 (' + knowledgeBaseRecord.kbDataSourceId + ')');
    console.log('   ✓ 删除Bedrock知识库 (' + knowledgeBaseRecord.knowledgeBaseId + ')');
    console.log('   ✓ 删除DynamoDB记录');
    
    console.log('\n✅ 知识库记录验证完成，可以安全删除');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testDeleteKnowledgeBase();
}

module.exports = { testDeleteKnowledgeBase };
