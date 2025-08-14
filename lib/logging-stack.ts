// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import {
  aws_dynamodb,
  aws_lambda_nodejs,
  aws_logs,
  aws_iam,
  Duration,
  NestedStack,
  NestedStackProps,
  RemovalPolicy,
} from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Architecture, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays, SubscriptionFilter, FilterPattern } from 'aws-cdk-lib/aws-logs';
import { LambdaDestination } from 'aws-cdk-lib/aws-logs-destinations';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import path from 'path';

interface LoggingStackProps extends NestedStackProps {
  // 传入现有的Lambda函数和资源，以便设置日志订阅
}

export class LoggingStack extends NestedStack {
  public readonly logAggregatorFunction: NodejsFunction;
  public readonly logQueryFunction: NodejsFunction;
  public readonly logAnalyticsTable: TableV2;
  public readonly systemMetricsTable: TableV2;

  constructor(scope: Construct, id: string, props?: LoggingStackProps) {
    super(scope, id, props);

    // 创建日志聚合表 - 存储结构化日志
    this.logAnalyticsTable = new TableV2(this, 'LogAnalyticsTable', {
      partitionKey: { name: 'logId', type: aws_dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: aws_dynamodb.AttributeType.STRING },
      globalSecondaryIndexes: [
        {
          indexName: 'service-timestamp-index',
          partitionKey: { name: 'serviceName', type: aws_dynamodb.AttributeType.STRING },
          sortKey: { name: 'timestamp', type: aws_dynamodb.AttributeType.STRING },
        },
        {
          indexName: 'level-timestamp-index',
          partitionKey: { name: 'level', type: aws_dynamodb.AttributeType.STRING },
          sortKey: { name: 'timestamp', type: aws_dynamodb.AttributeType.STRING },
        },
        {
          indexName: 'userId-timestamp-index',
          partitionKey: { name: 'userId', type: aws_dynamodb.AttributeType.STRING },
          sortKey: { name: 'timestamp', type: aws_dynamodb.AttributeType.STRING },
        },
      ],
      timeToLiveAttribute: 'ttl', // 日志自动过期
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // 创建系统指标表 - 存储聚合的系统指标
    this.systemMetricsTable = new TableV2(this, 'SystemMetricsTable', {
      partitionKey: { name: 'metricKey', type: aws_dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: aws_dynamodb.AttributeType.STRING },
      globalSecondaryIndexes: [
        {
          indexName: 'metricType-timestamp-index',
          partitionKey: { name: 'metricType', type: aws_dynamodb.AttributeType.STRING },
          sortKey: { name: 'timestamp', type: aws_dynamodb.AttributeType.STRING },
        },
      ],
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // 创建日志聚合和处理Lambda函数
    this.logAggregatorFunction = new NodejsFunction(this, 'LogAggregatorFunction', {
      description: 'Processes and aggregates logs from CloudWatch',
      entry: path.resolve(__dirname, 'lambdas', 'logging', 'logAggregator.ts'),
      memorySize: 1024,
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      tracing: Tracing.ACTIVE,
      timeout: Duration.minutes(5),
      environment: {
        POWERTOOLS_SERVICE_NAME: 'log-aggregator',
        POWERTOOLS_METRICS_NAMESPACE: 'genassess-logging',
        LOG_ANALYTICS_TABLE: this.logAnalyticsTable.tableName,
        SYSTEM_METRICS_TABLE: this.systemMetricsTable.tableName,
      },
      bundling: {
        minify: true,
        externalModules: ['@aws-sdk/client-dynamodb'],
      },
    });

    // 给日志聚合器Lambda权限
    this.logAnalyticsTable.grantReadWriteData(this.logAggregatorFunction);
    this.systemMetricsTable.grantReadWriteData(this.logAggregatorFunction);

    // 添加CloudWatch Logs权限
    this.logAggregatorFunction.addToRolePolicy(
      new PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          'logs:DescribeLogStreams',
          'logs:DescribeLogGroups',
        ],
        resources: ['*'],
      })
    );

    // 创建日志查询Lambda函数 - 为前端提供API
    this.logQueryFunction = new NodejsFunction(this, 'LogQueryFunction', {
      description: 'Provides log query API for admin dashboard',
      entry: path.resolve(__dirname, 'lambdas', 'logging', 'logQuery.ts'),
      memorySize: 512,
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      tracing: Tracing.ACTIVE,
      timeout: Duration.seconds(30),
      environment: {
        POWERTOOLS_SERVICE_NAME: 'log-query',
        POWERTOOLS_METRICS_NAMESPACE: 'genassess-logging',
        LOG_ANALYTICS_TABLE: this.logAnalyticsTable.tableName,
        SYSTEM_METRICS_TABLE: this.systemMetricsTable.tableName,
      },
      bundling: {
        minify: true,
        externalModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/client-cloudwatch-logs'],
      },
    });

    // 给查询Lambda权限
    this.logAnalyticsTable.grantReadData(this.logQueryFunction);
    this.systemMetricsTable.grantReadData(this.logQueryFunction);

    // 添加CloudWatch Logs查询权限
    this.logQueryFunction.addToRolePolicy(
      new PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        actions: [
          'logs:StartQuery',
          'logs:GetQueryResults',
          'logs:DescribeLogGroups',
          'logs:DescribeLogStreams',
          'logs:FilterLogEvents',
        ],
        resources: ['*'],
      })
    );

    // 创建错误告警Lambda函数
    const errorAlertFunction = new NodejsFunction(this, 'ErrorAlertFunction', {
      description: 'Sends alerts for critical errors',
      entry: path.resolve(__dirname, 'lambdas', 'logging', 'errorAlert.ts'),
      memorySize: 256,
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      tracing: Tracing.ACTIVE,
      timeout: Duration.seconds(30),
      environment: {
        POWERTOOLS_SERVICE_NAME: 'error-alert',
        POWERTOOLS_METRICS_NAMESPACE: 'genassess-logging',
      },
      bundling: {
        minify: true,
        externalModules: ['@aws-sdk/client-sns'],
      },
    });

    // 为错误告警添加SNS权限
    errorAlertFunction.addToRolePolicy(
      new PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        actions: ['sns:Publish'],
        resources: ['*'],
      })
    );

    // 输出重要资源的ARN，供其他stack使用
    new cdk.CfnOutput(this, 'LogAggregatorFunctionArn', {
      value: this.logAggregatorFunction.functionArn,
      description: 'Log Aggregator Function ARN',
    });

    new cdk.CfnOutput(this, 'LogQueryFunctionArn', {
      value: this.logQueryFunction.functionArn,
      description: 'Log Query Function ARN',
    });
  }

  /**
   * 为指定的Lambda函数设置日志订阅
   */
  public setupLogSubscription(lambdaFunction: NodejsFunction, logGroupName: string) {
    const subscriptionFilter = new SubscriptionFilter(
      this,
      `${lambdaFunction.node.id}LogSubscription`,
      {
        logGroup: LogGroup.fromLogGroupName(this, `${lambdaFunction.node.id}LogGroup`, logGroupName),
        destination: new LambdaDestination(this.logAggregatorFunction),
        filterPattern: FilterPattern.allEvents(),
      }
    );

    // 给日志聚合器调用权限
    this.logAggregatorFunction.addPermission(`${lambdaFunction.node.id}LogsPermission`, {
      principal: new aws_iam.ServicePrincipal('logs.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceArn: `arn:aws:logs:${this.region}:${this.account}:log-group:${logGroupName}:*`,
    });

    return subscriptionFilter;
  }
}
