// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { AppSyncResolverEvent, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';

const ddbClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(ddbClient);

const logger = new Logger({
  serviceName: process.env.POWERTOOLS_SERVICE_NAME || 'log-query'
});

const tracer = new Tracer();

interface LogQueryRequest {
  operation: 'getLogs' | 'getMetrics' | 'getLogGroups' | 'searchLogs' | 'getSystemHealth';
  filters?: {
    serviceName?: string;
    level?: string;
    userId?: string;
    startTime?: string;
    endTime?: string;
    timeRange?: string; // '1h', '24h', '7d', '30d'
    limit?: number;
  };
  searchQuery?: string;
}

interface LogEntry {
  logId: string;
  timestamp: string;
  message: string;
  level: string;
  serviceName?: string;
  userId?: string;
  requestId?: string;
  errorType?: string;
  stackTrace?: string;
  duration?: number;
  memoryUsed?: number;
  billedDuration?: number;
}

interface SystemMetric {
  metricKey: string;
  timestamp: string;
  metricType: string;
  value: number;
  dimensions: Record<string, string>;
}

interface SystemHealthSummary {
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
  memoryUtilization: number;
  topErrors: Array<{ errorType: string; count: number }>;
  serviceHealth: Array<{ serviceName: string; status: string; errorCount: number }>;
}

class LogQueryHandler implements LambdaInterface {
  @tracer.captureLambdaHandler()
  async handler(event: AppSyncResolverEvent<LogQueryRequest>, context: Context): Promise<any> {
    try {
      const request = event.arguments;
      logger.info('Processing log query request', { operation: request.operation });

      switch (request.operation) {
        case 'getLogs':
          return await this.getLogs(request.filters || {});
        case 'getMetrics':
          return await this.getMetrics(request.filters || {});
        case 'getLogGroups':
          return await this.getLogGroups();
        case 'searchLogs':
          return await this.searchLogs(request.searchQuery || '', request.filters || {});
        case 'getSystemHealth':
          return await this.getSystemHealth(request.filters || {});
        default:
          throw new Error(`Unsupported operation: ${request.operation}`);
      }
    } catch (error: any) {
      logger.error('Failed to process log query', { error: error?.message || 'Unknown error' });
      throw error;
    }
  }

  private async getLogs(filters: any): Promise<{ logs: LogEntry[]; nextToken?: string }> {
    const { serviceName, level, userId, startTime, endTime, timeRange, limit = 100 } = filters;
    
    // 计算时间范围
    const timeFilter = this.calculateTimeRange(startTime, endTime, timeRange);
    
    let command: QueryCommand | ScanCommand;
    
    if (serviceName) {
      // 使用GSI按服务名查询
      command = new QueryCommand({
        TableName: process.env.LOG_ANALYTICS_TABLE!,
        IndexName: 'service-timestamp-index',
        KeyConditionExpression: 'serviceName = :serviceName AND #timestamp BETWEEN :startTime AND :endTime',
        FilterExpression: this.buildFilterExpression({ level, userId }),
        ExpressionAttributeNames: {
          '#timestamp': 'timestamp'
        },
        ExpressionAttributeValues: {
          ':serviceName': serviceName,
          ':startTime': timeFilter.startTime,
          ':endTime': timeFilter.endTime,
          ...(level && { ':level': level }),
          ...(userId && { ':userId': userId })
        },
        ScanIndexForward: false, // 最新的在前
        Limit: limit
      });
    } else if (level) {
      // 使用GSI按日志级别查询
      command = new QueryCommand({
        TableName: process.env.LOG_ANALYTICS_TABLE!,
        IndexName: 'level-timestamp-index',
        KeyConditionExpression: '#level = :level AND #timestamp BETWEEN :startTime AND :endTime',
        FilterExpression: this.buildFilterExpression({ userId }),
        ExpressionAttributeNames: {
          '#level': 'level',
          '#timestamp': 'timestamp'
        },
        ExpressionAttributeValues: {
          ':level': level,
          ':startTime': timeFilter.startTime,
          ':endTime': timeFilter.endTime,
          ...(userId && { ':userId': userId })
        },
        ScanIndexForward: false,
        Limit: limit
      });
    } else if (userId) {
      // 使用GSI按用户ID查询
      command = new QueryCommand({
        TableName: process.env.LOG_ANALYTICS_TABLE!,
        IndexName: 'userId-timestamp-index',
        KeyConditionExpression: 'userId = :userId AND #timestamp BETWEEN :startTime AND :endTime',
        ExpressionAttributeNames: {
          '#timestamp': 'timestamp'
        },
        ExpressionAttributeValues: {
          ':userId': userId,
          ':startTime': timeFilter.startTime,
          ':endTime': timeFilter.endTime
        },
        ScanIndexForward: false,
        Limit: limit
      });
    } else {
      // 扫描所有记录（添加时间过滤）
      command = new ScanCommand({
        TableName: process.env.LOG_ANALYTICS_TABLE!,
        FilterExpression: '#timestamp BETWEEN :startTime AND :endTime',
        ExpressionAttributeNames: {
          '#timestamp': 'timestamp'
        },
        ExpressionAttributeValues: {
          ':startTime': timeFilter.startTime,
          ':endTime': timeFilter.endTime
        },
        Limit: limit
      });
    }

    const result = await docClient.send(command);
    
    return {
      logs: (result.Items || []) as LogEntry[],
      nextToken: result.LastEvaluatedKey ? JSON.stringify(result.LastEvaluatedKey) : undefined
    };
  }

  private async getMetrics(filters: any): Promise<{ metrics: SystemMetric[] }> {
    const { timeRange = '24h', limit = 100 } = filters;
    const timeFilter = this.calculateTimeRange(undefined, undefined, timeRange);

    const command = new ScanCommand({
      TableName: process.env.SYSTEM_METRICS_TABLE!,
      FilterExpression: '#timestamp BETWEEN :startTime AND :endTime',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':startTime': timeFilter.startTime,
        ':endTime': timeFilter.endTime
      },
      Limit: limit
    });

    const result = await docClient.send(command);
    
    return {
      metrics: (result.Items || []) as SystemMetric[]
    };
  }

  private async getLogGroups(): Promise<{ logGroups: Array<{ name: string; status: string }> }> {
    // 返回预定义的日志组列表
    const logGroups = [
      { name: '/aws/lambda/gen-assess-stack-questions-generator', status: 'ACTIVE' },
      { name: '/aws/lambda/gen-assess-stack-grade-assessment', status: 'ACTIVE' },
      { name: '/aws/lambda/gen-assess-stack-publish-assessment', status: 'ACTIVE' },
      { name: '/aws/lambda/gen-assess-stack-rag-pipeline', status: 'ACTIVE' },
      { name: '/aws/appsync/apis/gen-assess-api', status: 'ACTIVE' }
    ];

    return { logGroups };
  }

  private async searchLogs(searchQuery: string, filters: any): Promise<{ logs: LogEntry[] }> {
    // 使用DynamoDB扫描进行文本搜索（生产环境建议使用ElasticSearch）
    const timeFilter = this.calculateTimeRange(filters.startTime, filters.endTime, filters.timeRange);
    
    const command = new ScanCommand({
      TableName: process.env.LOG_ANALYTICS_TABLE!,
      FilterExpression: 'contains(#message, :searchQuery) AND #timestamp BETWEEN :startTime AND :endTime',
      ExpressionAttributeNames: {
        '#message': 'message',
        '#timestamp': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':searchQuery': searchQuery,
        ':startTime': timeFilter.startTime,
        ':endTime': timeFilter.endTime
      },
      Limit: filters.limit || 100
    });

    const result = await docClient.send(command);
    
    return {
      logs: (result.Items || []) as LogEntry[]
    };
  }

  private async getSystemHealth(filters: any): Promise<SystemHealthSummary> {
    const timeFilter = this.calculateTimeRange(undefined, undefined, filters.timeRange || '1h');
    
    // 获取错误指标
    const errorMetricsCommand = new QueryCommand({
      TableName: process.env.SYSTEM_METRICS_TABLE!,
      IndexName: 'metricType-timestamp-index',
      KeyConditionExpression: 'metricType = :metricType AND #timestamp BETWEEN :startTime AND :endTime',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':metricType': 'error_count',
        ':startTime': timeFilter.startTime,
        ':endTime': timeFilter.endTime
      }
    });

    // 获取性能指标
    const performanceMetricsCommand = new QueryCommand({
      TableName: process.env.SYSTEM_METRICS_TABLE!,
      IndexName: 'metricType-timestamp-index',
      KeyConditionExpression: 'metricType = :metricType AND #timestamp BETWEEN :startTime AND :endTime',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':metricType': 'lambda_duration',
        ':startTime': timeFilter.startTime,
        ':endTime': timeFilter.endTime
      }
    });

    const [errorMetrics, performanceMetrics] = await Promise.all([
      docClient.send(errorMetricsCommand),
      docClient.send(performanceMetricsCommand)
    ]);

    // 计算健康指标
    const totalRequests = (performanceMetrics.Items || []).reduce((sum, item) => sum + (item.value || 0), 0);
    const totalErrors = (errorMetrics.Items || []).reduce((sum, item) => sum + (item.value || 0), 0);
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    
    const averageResponseTime = totalRequests > 0 
      ? (performanceMetrics.Items || []).reduce((sum, item) => sum + (item.value || 0), 0) / totalRequests
      : 0;

    // 统计错误类型
    const errorTypes = new Map<string, number>();
    (errorMetrics.Items || []).forEach(item => {
      const errorType = item.dimensions?.errorType || 'Unknown';
      errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + (item.value || 0));
    });

    const topErrors = Array.from(errorTypes.entries())
      .map(([errorType, count]) => ({ errorType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 服务健康状态
    const serviceErrors = new Map<string, number>();
    (errorMetrics.Items || []).forEach(item => {
      const serviceName = item.dimensions?.service || 'Unknown';
      serviceErrors.set(serviceName, (serviceErrors.get(serviceName) || 0) + (item.value || 0));
    });

    const serviceHealth = Array.from(serviceErrors.entries()).map(([serviceName, errorCount]) => ({
      serviceName,
      status: errorCount > 10 ? 'UNHEALTHY' : errorCount > 5 ? 'WARNING' : 'HEALTHY',
      errorCount
    }));

    return {
      totalRequests,
      errorRate,
      averageResponseTime,
      memoryUtilization: 0, // 需要额外的内存指标计算
      topErrors,
      serviceHealth
    };
  }

  private buildFilterExpression(filters: any): string | undefined {
    const conditions = [];
    
    if (filters.level) {
      conditions.push('#level = :level');
    }
    
    if (filters.userId) {
      conditions.push('userId = :userId');
    }
    
    return conditions.length > 0 ? conditions.join(' AND ') : undefined;
  }

  private calculateTimeRange(startTime?: string, endTime?: string, timeRange?: string) {
    let start: Date;
    let end = new Date();

    if (startTime && endTime) {
      start = new Date(startTime);
      end = new Date(endTime);
    } else if (timeRange) {
      start = new Date();
      switch (timeRange) {
        case '1h':
          start.setHours(start.getHours() - 1);
          break;
        case '24h':
          start.setHours(start.getHours() - 24);
          break;
        case '7d':
          start.setDate(start.getDate() - 7);
          break;
        case '30d':
          start.setDate(start.getDate() - 30);
          break;
        default:
          start.setHours(start.getHours() - 1);
      }
    } else {
      start = new Date();
      start.setHours(start.getHours() - 24); // 默认24小时
    }

    return {
      startTime: start.toISOString(),
      endTime: end.toISOString()
    };
  }
}

// Lambda handler
const handlerClass = new LogQueryHandler();
export const handler = handlerClass.handler.bind(handlerClass);
