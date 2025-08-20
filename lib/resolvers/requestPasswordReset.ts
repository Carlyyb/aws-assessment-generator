// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 密码重置请求解析器
 * 支持通过邮箱或手机号发送密码重置链接/验证码
 */

import { AppSyncResolverEvent } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminGetUserCommand, ForgotPasswordCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
// import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
// import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { randomBytes } from 'crypto';

// 客户端初始化
const cognitoClient = new CognitoIdentityProviderClient({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const ssmClient = new SSMClient({});
// const snsClient = new SNSClient({});
// const sesClient = new SESClient({});

interface PasswordResetRequestInput {
  identifier: string;  // 用户名、邮箱或手机号
  resetMethod: string; // email 或 sms
}

/**
 * 获取系统参数
 */
async function getSystemParameter(paramName: string): Promise<string> {
  try {
    const response = await ssmClient.send(new GetParameterCommand({
      Name: paramName,
      WithDecryption: true
    }));
    return response.Parameter?.Value || '';
  } catch (error) {
    console.error(`获取参数 ${paramName} 失败:`, error);
    throw new Error(`Failed to get parameter: ${paramName}`);
  }
}

/**
 * 根据标识符查找用户
 */
async function findUserByIdentifier(identifier: string, usersTableName: string): Promise<any> {
  try {
    // 首先尝试作为用户名查找
    const response = await docClient.send(new QueryCommand({
      TableName: usersTableName,
      KeyConditionExpression: 'id = :identifier',
      ExpressionAttributeValues: {
        ':identifier': identifier
      }
    }));

    if (response.Items && response.Items.length > 0) {
      return response.Items[0];
    }

    // 如果没有找到，尝试作为邮箱查找（需要GSI）
    if (identifier.includes('@')) {
      const emailResponse = await docClient.send(new QueryCommand({
        TableName: usersTableName,
        IndexName: 'EmailIndex', // 需要在表中创建这个GSI
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': identifier
        }
      }));

      if (emailResponse.Items && emailResponse.Items.length > 0) {
        return emailResponse.Items[0];
      }
    }

    // 如果没有找到，尝试作为手机号查找（需要GSI）
    if (/^1[3-9]\d{9}$/.test(identifier)) {
      const phoneResponse = await docClient.send(new QueryCommand({
        TableName: usersTableName,
        IndexName: 'PhoneIndex', // 需要在表中创建这个GSI
        KeyConditionExpression: 'phoneNumber = :phone',
        ExpressionAttributeValues: {
          ':phone': identifier
        }
      }));

      if (phoneResponse.Items && phoneResponse.Items.length > 0) {
        return phoneResponse.Items[0];
      }
    }

    return null;
  } catch (error) {
    console.error('查找用户失败:', error);
    throw error;
  }
}

/**
 * 生成密码重置令牌
 */
function generateResetToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * 存储密码重置令牌
 */
async function storeResetToken(username: string, token: string, resetTokenTableName: string): Promise<void> {
  const expirationTime = new Date(Date.now() + 15 * 60 * 1000); // 15分钟后过期

  await docClient.send(new PutCommand({
    TableName: resetTokenTableName,
    Item: {
      token,
      username,
      expiresAt: expirationTime.toISOString(),
      createdAt: new Date().toISOString(),
      used: false,
      ttl: Math.floor(expirationTime.getTime() / 1000) // TTL自动清理过期令牌
    }
  }));
}

/**
 * 发送密码重置邮件
 */
async function sendPasswordResetEmail(email: string, token: string, fromEmail: string): Promise<void> {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  
  const emailParams = {
    Source: fromEmail,
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Subject: {
        Data: '密码重置请求 - 智能测试系统',
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: `
            <html>
              <body>
                <h2>密码重置请求</h2>
                <p>您好，</p>
                <p>我们收到了您的密码重置请求。请点击下面的链接重置您的密码：</p>
                <p><a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px;">重置密码</a></p>
                <p>如果上面的按钮无法点击，请复制以下链接到浏览器地址栏：</p>
                <p>${resetUrl}</p>
                <p>此链接将在15分钟后失效。如果您没有请求重置密码，请忽略此邮件。</p>
                <p>谢谢！<br/>智能测试系统团队</p>
              </body>
            </html>
          `,
          Charset: 'UTF-8'
        },
        Text: {
          Data: `
            密码重置请求
            
            您好，
            
            我们收到了您的密码重置请求。请复制以下链接到浏览器地址栏来重置您的密码：
            
            ${resetUrl}
            
            此链接将在15分钟后失效。如果您没有请求重置密码，请忽略此邮件。
            
            谢谢！
            智能测试系统团队
          `,
          Charset: 'UTF-8'
        }
      }
    }
  };

  // 发送邮件 (暂时禁用，需要配置SES)
  // await sesClient.send(new SendEmailCommand(emailParams));
  console.log('邮件发送功能暂时禁用');
}

/**
 * 发送密码重置短信
 */
async function sendPasswordResetSMS(phoneNumber: string, token: string): Promise<void> {
  // 生成6位数字验证码而不是完整令牌
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  
  const message = `【智能测试系统】您的密码重置验证码是: ${verificationCode}，15分钟内有效。如非本人操作，请忽略此短信。`;
  
  // 发送短信 (暂时禁用，需要配置SNS)
  // await snsClient.send(new PublishCommand({
  //   PhoneNumber: phoneNumber,
  //   Message: message
  // }));
  console.log('短信发送功能暂时禁用');

  // 注意：实际应用中，应该将验证码与令牌关联存储
  // 这里简化处理，假设token就是验证码
}

/**
 * 密码重置请求主函数
 */
export const handler = async (event: AppSyncResolverEvent<{ input: PasswordResetRequestInput }>): Promise<boolean> => {
  console.log('密码重置请求:', JSON.stringify(event, null, 2));

  const { input } = event.arguments;
  const { identifier, resetMethod } = input;

  if (!identifier || !resetMethod) {
    throw new Error('标识符和重置方式不能为空');
  }

  if (!['email', 'sms'].includes(resetMethod)) {
    throw new Error('无效的重置方式，只支持 email 或 sms');
  }

  try {
    // 获取系统参数
    const [usersTableName, resetTokenTableName, fromEmail] = await Promise.all([
      getSystemParameter('/gen-assess/users-table-name'),
      getSystemParameter('/gen-assess/reset-token-table-name'),
      getSystemParameter('/gen-assess/system-email').catch(() => 'noreply@system.local')
    ]);

    // 查找用户
    const user = await findUserByIdentifier(identifier, usersTableName);
    if (!user) {
      // 为了安全，即使用户不存在也返回成功，不要暴露用户是否存在
      console.log(`用户 ${identifier} 不存在，但返回成功以保护隐私`);
      return true;
    }

    // 生成重置令牌
    const resetToken = generateResetToken();

    // 存储令牌
    await storeResetToken(user.username, resetToken, resetTokenTableName);

    // 根据重置方式发送通知
    if (resetMethod === 'email') {
      if (!user.email) {
        throw new Error('该账号未绑定邮箱，无法通过邮件重置密码');
      }
      await sendPasswordResetEmail(user.email, resetToken, fromEmail);
    } else if (resetMethod === 'sms') {
      if (!user.phoneNumber) {
        throw new Error('该账号未绑定手机号，无法通过短信重置密码');
      }
      await sendPasswordResetSMS(user.phoneNumber, resetToken);
    }

    console.log(`密码重置请求已发送给用户 ${user.username}，方式: ${resetMethod}`);
    return true;

  } catch (error: any) {
    console.error('密码重置请求失败:', error);
    throw new Error(`密码重置请求失败: ${error.message}`);
  }
};