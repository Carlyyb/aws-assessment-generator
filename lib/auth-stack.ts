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

export class AuthStack extends NestedStack {
  // Cognito 用户池对象
  public userPool: aws_cognito.UserPool;
  // Cognito 用户池客户端（用于前端登录）
  public client: aws_cognito.UserPoolClient;
  // Cognito 身份池（用于 AWS 资源授权）
  public identityPool: IdentityPool;
  // 注册后触发的 Lambda 函数
  public postConfirmationLambda: NodejsFunction;

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

    // Cognito 用户池，支持邮箱注册和登录
    const userPool = new aws_cognito.UserPool(this, 'pool', {
      selfSignUpEnabled: true, // 允许自助注册
      signInAliases: { username: false, email: true }, // 仅邮箱登录
      customAttributes: {
        'role': new StringAttribute({ minLen: 8, maxLen: 8, mutable: false }), // 自定义角色属性
      },
      autoVerify: { email: true }, // 自动邮箱验证
      removalPolicy: RemovalPolicy.DESTROY, // 堆栈删除时销毁资源
      lambdaTriggers: {
        postConfirmation: postConfirmation, // 注册后触发 Lambda
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

    // Lambda 必须有角色，否则抛出异常
    if (!postConfirmation.role) {
      throw new Error("err");
    }
    policy.attachToRole(postConfirmation.role);

    // 创建教师分组
    const teachersUserGroup = new aws_cognito.CfnUserPoolGroup(this, 'TeachersGroup', {
      groupName: 'teachers',
      userPoolId: userPool.userPoolId,
    });

    // 创建学生分组
    const studentsUserGroup = new aws_cognito.CfnUserPoolGroup(this, 'StudentsGroup', {
      groupName: 'students',
      userPoolId: userPool.userPoolId,
    });

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
  }
}
