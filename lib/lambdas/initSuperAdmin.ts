// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 初始化超级管理员账号的Lambda函数
 * 在CDK部署时通过CustomResource调用，创建系统的第一个超级管理员账号
 */

import { Context, CloudFormationCustomResourceEvent } from "aws-lambda";
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminGetUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { SUPER_ADMIN_CONFIG } from "../config/adminConfig";

const cognitoClient = new CognitoIdentityProviderClient();

export async function handler(event: CloudFormationCustomResourceEvent, context: Context) {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { RequestType, ResourceProperties } = event;
  const { UserPoolId } = ResourceProperties;
  
  try {
    if (RequestType === 'Create' || RequestType === 'Update') {
      await createSuperAdminUser(UserPoolId);
      
      return {
        StatusCode: 200,
        PhysicalResourceId: `super-admin-init-${Date.now()}`,
        Data: {
          Message: 'Super admin user created successfully'
        }
      };
    } else if (RequestType === 'Delete') {
      // 删除时不需要删除用户，保留超级管理员账号
      return {
        StatusCode: 200,
        PhysicalResourceId: event.PhysicalResourceId,
        Data: {
          Message: 'Super admin user preserved'
        }
      };
    }
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

async function createSuperAdminUser(userPoolId: string) {
  const { username, email, defaultPassword, name } = SUPER_ADMIN_CONFIG;
  
  try {
    // 检查用户是否已存在
    try {
      await cognitoClient.send(new AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: username
      }));
      console.log(`Super admin user ${username} already exists, skipping creation`);
      return;
    } catch (error: any) {
      if (error.name !== 'UserNotFoundException') {
        throw error;
      }
      // 用户不存在，继续创建
    }
    
    // 创建超级管理员用户 - 只设置必需属性
    const createUserParams = {
      UserPoolId: userPoolId,
      Username: username, // 账号名
      UserAttributes: [
        // 设置显示名称
        { Name: 'preferred_username', Value: name },
        // 设置角色
        { Name: 'custom:role', Value: 'super_admin' },
        // 可选：设置邮箱（用于密码恢复）
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
      ],
      TemporaryPassword: defaultPassword, // 临时密码，首次登录后需要修改
      MessageAction: 'SUPPRESS' as const, // 不发送欢迎邮件
    };
    
    await cognitoClient.send(new AdminCreateUserCommand(createUserParams));
    console.log(`Created super admin user: ${username}`);
    
    // 将用户添加到super_admin组
    await cognitoClient.send(new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: username,
      GroupName: 'super_admin'
    }));
    console.log(`Added ${username} to super_admin group`);
    
  } catch (error) {
    console.error('Failed to create super admin user:', error);
    throw error;
  }
}
