// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * AuthStack 账号系统基础设施定义：
 * - 创建 Cognito 用户池（UserPool），支持自助注册和邮箱登录
 * - 定义自定义属性和分组（教师/学生）
 * - 注册后触发 Lambda 进行自定义逻辑
 * - 配置 IdentityPool 支持 AWS 资源授权
 * - 相关参数存储到 SSM Parameter Store
 */
 
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import { aws_cognito, Duration, NestedStack, NestedStackProps, RemovalPolicy } from 'aws-cdk-lib';
import { IdentityPool, UserPoolAuthenticationProvider } from '@aws-cdk/aws-cognito-identitypool-alpha';
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import path from "path";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { StringAttribute } from "aws-cdk-lib/aws-cognito";
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';

export class AuthStack extends NestedStack {
  // Cognito 用户池对象
  public userPool: aws_cognito.UserPool;
  // Cognito 用户池客户端（用于前端登录）
  public client: aws_cognito.UserPoolClient;
  // Cognito 身份池（用于 AWS 资源授权）
  public identityPool: IdentityPool;
  // 注册后触发的 Lambda 函数
  public postConfirmationLambda: NodejsFunction;
  // 登录后触发的 Lambda 函数
  public postAuthenticationLambda: NodejsFunction;

  constructor(scope: Construct, id: string, props?: NestedStackProps) {
    super(scope, id, props);

    // 注册后触发的 Lambda，常用于写入数据库、分组等自定义逻辑
    const postConfirmation = new NodejsFunction(this, "PostConfirmationLambdaFunction", {
      entry: path.resolve(__dirname, 'lambdas', 'postConfirmation.ts'), // Lambda 入口文件
      handler: 'postConfirmation', // Lambda 处理函数名
      runtime: Runtime.NODEJS_20_X,
      environment: {
        'STUDENTS_TABLE_PARAM': '/gen-assess/student-table-name', // DynamoDB 学生表参数
      },
      timeout: Duration.seconds(30),
    });

    // 登录后触发的 Lambda，用于更新用户最后登录时间
    const postAuthentication = new NodejsFunction(this, "PostAuthenticationLambdaFunction", {
      entry: path.resolve(__dirname, 'lambdas', 'postAuthentication.ts'), // Lambda 入口文件
      handler: 'postAuthentication', // Lambda 处理函数名
      runtime: Runtime.NODEJS_20_X,
      environment: {
        'STUDENTS_TABLE_PARAM': '/gen-assess/student-table-name', // DynamoDB 学生表参数
        'USERS_TABLE_PARAM': '/gen-assess/users-table-name', // DynamoDB 用户表参数
      },
      timeout: Duration.seconds(30),
    });

    // Cognito 用户池，使用最小配置以避免更新冲突
    // 注意：以下属性在 UserPool 创建后不能修改：
    // - signInAliases / aliasAttributes
    // - usernameAttributes  
    // - customAttributes (schema)
    // - autoVerify (可能影响 usernameAttributes)
    // 
    // 为了避免更新冲突，我们创建一个新的用户池实例
    const userPool = new aws_cognito.UserPool(this, 'userPoolV2', {
      // 明确设置支持的登录方式，使用用户名登录（不强制邮箱）
      signInAliases: {
        username: true,
        email: false, // 不强制使用邮箱登录，支持账号迁移
      },
      // 简化的标准属性配置 - 只保留必需的name属性
      standardAttributes: {
        // email设为可选，不强制要求
        email: {
          required: false,
          mutable: true,
        },
        // 使用preferredUsername作为显示名称（对应前端的name字段）
        preferredUsername: {
          required: false,
          mutable: true,
        },
      },
      // 自定义属性：用户角色
      customAttributes: {
        role: new StringAttribute({ minLen: 1, maxLen: 50, mutable: true }),
      },
      // 关键：禁用自助注册 - 只能通过管理员创建账号
      selfSignUpEnabled: false,
      removalPolicy: RemovalPolicy.DESTROY,
      lambdaTriggers: {
        postConfirmation: postConfirmation,
        postAuthentication: postAuthentication,
      },
      // 简化密码策略，便于管理员创建账号
      passwordPolicy: {
        minLength: 8,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
      },
      // 账户恢复设置：仅支持邮箱恢复（如果用户有邮箱）
      accountRecovery: aws_cognito.AccountRecovery.EMAIL_ONLY,
      // 不自动验证邮箱，避免对没有邮箱的用户造成问题
      autoVerify: {
        email: false,
      },
    });

    // 将用户池 ID 存储到 SSM Parameter Store，便于其他服务引用
    const userPoolParam = new StringParameter(this, 'UserPoolParameter', {
      parameterName: '/gen-assess/user-pool-id',
      stringValue: userPool.userPoolId,
    });

    // 配置 Lambda 权限，允许管理 Cognito 用户和获取 SSM 参数
    const policy = new Policy(this, 'lambdaPolicyUserPool', {
      statements: [
        new PolicyStatement({
          actions: ['cognito-idp:AdminGetUser', 'cognito-idp:AdminAddUserToGroup', 'cognito-idp:AdminEnableUser', 'cognito-idp:AdminDisableUser'],
          resources: [userPool.userPoolArn], // 仅限本用户池
        }),
        new PolicyStatement({
          actions: ['ssm:DescribeParameters'],
          resources: ['*'],
        }),
        new PolicyStatement({
          actions: ['ssm:GetParameter*'],
          resources: [this.formatArn({
            service: "ssm",
            region: cdk.Aws.REGION,
            account: cdk.Aws.ACCOUNT_ID,
            resource: "parameter",
            resourceName: "gen-assess/*",
          })],
        }),
      ],
    });

    // 为postAuthentication Lambda创建单独的权限策略
    const postAuthPolicy = new Policy(this, 'lambdaPolicyPostAuth', {
      statements: [
        new PolicyStatement({
          actions: ['ssm:DescribeParameters'],
          resources: ['*'],
        }),
        new PolicyStatement({
          actions: ['ssm:GetParameter*'],
          resources: [this.formatArn({
            service: "ssm",
            region: cdk.Aws.REGION,
            account: cdk.Aws.ACCOUNT_ID,
            resource: "parameter",
            resourceName: "gen-assess/*",
          })],
        }),
        new PolicyStatement({
          actions: ['dynamodb:UpdateItem'],
          resources: [
            // 允许访问所有gen-assess相关的DynamoDB表
            this.formatArn({
              service: "dynamodb",
              region: cdk.Aws.REGION,
              account: cdk.Aws.ACCOUNT_ID,
              resource: "table",
              resourceName: "*GenAssess*",
            })
          ],
        }),
      ],
    });

    // Lambda 必须有角色，否则抛出异常
    if (!postConfirmation.role) {
      throw new Error("postConfirmation lambda role is undefined");
    }
    policy.attachToRole(postConfirmation.role);

    if (!postAuthentication.role) {
      throw new Error("postAuthentication lambda role is undefined");
    }
    postAuthPolicy.attachToRole(postAuthentication.role);

    // 创建教师分组
    const teachersUserGroup = new aws_cognito.CfnUserPoolGroup(this, 'TeachersGroupV2', {
      groupName: 'teachers',
      userPoolId: userPool.userPoolId,
      description: '教师用户组 - 可以创建课程、管理知识库、设置测试',
    });

    // 创建学生分组
    const studentsUserGroup = new aws_cognito.CfnUserPoolGroup(this, 'StudentsGroupV2', {
      groupName: 'students',
      userPoolId: userPool.userPoolId,
      description: '学生用户组 - 可以参与测试、查看测试结果',
    });

    // 创建管理员分组
    const adminUserGroup = new aws_cognito.CfnUserPoolGroup(this, 'AdminGroupV2', {
      groupName: 'admin',
      userPoolId: userPool.userPoolId,
      description: '管理员用户组 - 具有用户管理和系统管理权限',
    });

    // 创建超级管理员分组
    const superAdminUserGroup = new aws_cognito.CfnUserPoolGroup(this, 'SuperAdminGroupV2', {
      groupName: 'super_admin',
      userPoolId: userPool.userPoolId,
      description: '超级管理员用户组 - 具有所有系统权限包括日志访问',
    });

    // 创建初始化超级管理员的Lambda函数
    const initSuperAdminLambda = new NodejsFunction(this, "InitSuperAdminLambdaV2", {
      entry: path.resolve(__dirname, 'lambdas', 'initSuperAdmin.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(60),
    });

    // 给Lambda权限管理Cognito用户
    const initSuperAdminPolicy = new Policy(this, 'InitSuperAdminPolicyV2', {
      statements: [
        new PolicyStatement({
          actions: [
            'cognito-idp:AdminCreateUser',
            'cognito-idp:AdminAddUserToGroup',
            'cognito-idp:AdminGetUser'
          ],
          resources: [userPool.userPoolArn],
        }),
      ],
    });

    if (!initSuperAdminLambda.role) {
      throw new Error("InitSuperAdminLambda role is undefined");
    }
    initSuperAdminPolicy.attachToRole(initSuperAdminLambda.role);

    // 使用CustomResource在部署时创建超级管理员
    const initSuperAdminResource = new AwsCustomResource(this, 'InitSuperAdminResourceV2', {
      onCreate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: initSuperAdminLambda.functionName,
          Payload: JSON.stringify({
            RequestType: 'Create',
            ResourceProperties: {
              UserPoolId: userPool.userPoolId
            }
          })
        },
        physicalResourceId: PhysicalResourceId.of('init-super-admin'),
      },
      onUpdate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: initSuperAdminLambda.functionName,
          Payload: JSON.stringify({
            RequestType: 'Update',
            ResourceProperties: {
              UserPoolId: userPool.userPoolId
            }
          })
        },
        physicalResourceId: PhysicalResourceId.of('init-super-admin'),
      },
      policy: AwsCustomResourcePolicy.fromStatements([
        new PolicyStatement({
          actions: ['lambda:InvokeFunction'],
          resources: [initSuperAdminLambda.functionArn],
        }),
      ]),
    });

    // 确保资源依赖关系
    initSuperAdminResource.node.addDependency(superAdminUserGroup);
    initSuperAdminResource.node.addDependency(initSuperAdminLambda);

    // 创建用户池客户端，供前端登录使用
    const client = userPool.addClient('gen-assess-client');

    // 创建身份池，支持 AWS 资源授权
    const identityPool = new IdentityPool(this, 'IdentityPool', {
      authenticationProviders: {
        userPools: [new UserPoolAuthenticationProvider({ userPool, userPoolClient: client })],
      },
    });

    // 导出资源，供其他堆栈或前端使用
    this.userPool = userPool;
    this.client = client;
    this.identityPool = identityPool;
    this.postConfirmationLambda = postConfirmation;
    this.postAuthenticationLambda = postAuthentication;
  }
}
