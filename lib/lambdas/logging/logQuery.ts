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
  operation: 'getLogs' | 'getMetrics' | 'getLogGroups' | 'searchLogs' | 'getSystemHealth' | 'getErrorDetail' | 'getServiceStats' | 'getRequestStats';
  filters?: {
    serviceName?: string;
    level?: string;
    userId?: string;
    startTime?: string;
    endTime?: string;
    timeRange?: string; // '1h', '24h', '7d', '30d'
    limit?: number;
    logId?: string; // 用于获取错误详情
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
  serviceHealth: Array<{ serviceName: string; status: string; errorCount: number; requestCount: number }>;
}

interface ErrorDetail {
  logId: string;
  timestamp: string;
  serviceName: string;
  errorType: string;
  message: string;
  stackTrace?: string;
  requestId?: string;
  userId?: string;
  context: {
    duration?: number;
    memoryUsed?: number;
    billedDuration?: number;
    relatedRequests?: LogEntry[];
  };
}

interface ServiceStats {
  serviceName: string;
  requestCount: number;
  errorCount: number;
  avgDuration: number;
  avgMemoryUsed: number;
  errorRate: number;
  lastActivity: string;
  peakMemory: number;
  slowestRequest: number;
}

interface RequestStats {
  serviceName: string;
  hourlyData: Array<{
    hour: string;
    requestCount: number;
    errorCount: number;
    avgDuration: number;
    peakMemory: number;
  }>;
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
        case 'getErrorDetail':
          return await this.getErrorDetail(request.filters || {});
        case 'getServiceStats':
          return await this.getServiceStats(request.filters || {});
        case 'getRequestStats':
          return await this.getRequestStats(request.filters || {});
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
      errorCount,
      requestCount: 0 // 临时设置，需要从性能指标中获取
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

  private async getErrorDetail(filters: any): Promise<ErrorDetail | null> {
    const { logId } = filters;
    
    if (!logId) {
      throw new Error('logId is required for error detail query');
    }

    // 查询错误日志详情
    const command = new ScanCommand({
      TableName: process.env.LOG_ANALYTICS_TABLE!,
      FilterExpression: 'logId = :logId',
      ExpressionAttributeValues: {
        ':logId': logId
      }
    });

    const result = await docClient.send(command);
    const logEntry = result.Items?.[0] as LogEntry;

    if (!logEntry) {
      return null;
    }

    // 查找相关请求（同一个requestId的其他日志）
    let relatedRequests: LogEntry[] = [];
    if (logEntry.requestId) {
      const relatedCommand = new ScanCommand({
        TableName: process.env.LOG_ANALYTICS_TABLE!,
        FilterExpression: 'requestId = :requestId AND logId <> :currentLogId',
        ExpressionAttributeValues: {
          ':requestId': logEntry.requestId,
          ':currentLogId': logId
        },
        Limit: 10
      });

      const relatedResult = await docClient.send(relatedCommand);
      relatedRequests = (relatedResult.Items || []) as LogEntry[];
    }

    return {
      logId: logEntry.logId,
      timestamp: logEntry.timestamp,
      serviceName: logEntry.serviceName || 'unknown',
      errorType: logEntry.errorType || 'Unknown Error',
      message: logEntry.message,
      stackTrace: logEntry.stackTrace,
      requestId: logEntry.requestId,
      userId: logEntry.userId,
      context: {
        duration: logEntry.duration,
        memoryUsed: logEntry.memoryUsed,
        billedDuration: logEntry.billedDuration,
        relatedRequests
      }
    };
  }

  private async getServiceStats(filters: any): Promise<ServiceStats[]> {
    const timeFilter = this.calculateTimeRange(filters.startTime, filters.endTime, filters.timeRange || '24h');
    
    // 获取所有服务指标
    const metricsCommand = new ScanCommand({
      TableName: process.env.SYSTEM_METRICS_TABLE!,
      FilterExpression: '#timestamp BETWEEN :startTime AND :endTime',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':startTime': timeFilter.startTime,
        ':endTime': timeFilter.endTime
      }
    });

    const metricsResult = await docClient.send(metricsCommand);
    const metrics = (metricsResult.Items || []) as SystemMetric[];

    // 按服务聚合统计
    const serviceMap = new Map<string, {
      requestCount: number;
      errorCount: number;
      totalDuration: number;
      totalMemory: number;
      maxMemory: number;
      maxDuration: number;
      lastActivity: string;
    }>();

    metrics.forEach(metric => {
      const service = metric.dimensions?.service || 'unknown';
      
      if (!serviceMap.has(service)) {
        serviceMap.set(service, {
          requestCount: 0,
          errorCount: 0,
          totalDuration: 0,
          totalMemory: 0,
          maxMemory: 0,
          maxDuration: 0,
          lastActivity: metric.timestamp
        });
      }

      const stats = serviceMap.get(service)!;

      switch (metric.metricType) {
        case 'lambda_duration':
          stats.requestCount += 1;
          stats.totalDuration += metric.value;
          stats.maxDuration = Math.max(stats.maxDuration, metric.value);
          break;
        case 'lambda_memory_used':
          stats.totalMemory += metric.value;
          stats.maxMemory = Math.max(stats.maxMemory, metric.value);
          break;
        case 'error_count':
          stats.errorCount += metric.value;
          break;
      }

      if (metric.timestamp > stats.lastActivity) {
        stats.lastActivity = metric.timestamp;
      }
    });

    // 转换为返回格式
    return Array.from(serviceMap.entries()).map(([serviceName, stats]) => ({
      serviceName,
      requestCount: stats.requestCount,
      errorCount: stats.errorCount,
      avgDuration: stats.requestCount > 0 ? stats.totalDuration / stats.requestCount : 0,
      avgMemoryUsed: stats.requestCount > 0 ? stats.totalMemory / stats.requestCount : 0,
      errorRate: stats.requestCount > 0 ? (stats.errorCount / stats.requestCount) * 100 : 0,
      lastActivity: stats.lastActivity,
      peakMemory: stats.maxMemory,
      slowestRequest: stats.maxDuration
    }));
  }

  private async getRequestStats(filters: any): Promise<RequestStats[]> {
    const timeFilter = this.calculateTimeRange(filters.startTime, filters.endTime, filters.timeRange || '24h');
    
    // 获取请求相关指标
    const metricsCommand = new ScanCommand({
      TableName: process.env.SYSTEM_METRICS_TABLE!,
      FilterExpression: '#timestamp BETWEEN :startTime AND :endTime AND (#metricType = :duration OR #metricType = :memory OR #metricType = :error)',
      ExpressionAttributeNames: {
        '#timestamp': 'timestamp',
        '#metricType': 'metricType'
      },
      ExpressionAttributeValues: {
        ':startTime': timeFilter.startTime,
        ':endTime': timeFilter.endTime,
        ':duration': 'lambda_duration',
        ':memory': 'lambda_memory_used',
        ':error': 'error_count'
      }
    });

    const result = await docClient.send(metricsCommand);
    const metrics = (result.Items || []) as SystemMetric[];

    // 按服务和小时聚合
    const serviceHourMap = new Map<string, Map<string, {
      requestCount: number;
      errorCount: number;
      totalDuration: number;
      maxMemory: number;
    }>>();

    metrics.forEach(metric => {
      const service = metric.dimensions?.service || 'unknown';
      const hour = new Date(metric.timestamp).toISOString().substring(0, 13) + ':00:00.000Z';

      if (!serviceHourMap.has(service)) {
        serviceHourMap.set(service, new Map());
      }

      const hourMap = serviceHourMap.get(service)!;
      if (!hourMap.has(hour)) {
        hourMap.set(hour, {
          requestCount: 0,
          errorCount: 0,
          totalDuration: 0,
          maxMemory: 0
        });
      }

      const stats = hourMap.get(hour)!;

      switch (metric.metricType) {
        case 'lambda_duration':
          stats.requestCount += 1;
          stats.totalDuration += metric.value;
          break;
        case 'lambda_memory_used':
          stats.maxMemory = Math.max(stats.maxMemory, metric.value);
          break;
        case 'error_count':
          stats.errorCount += metric.value;
          break;
      }
    });

    // 转换为返回格式
    return Array.from(serviceHourMap.entries()).map(([serviceName, hourMap]) => ({
      serviceName,
      hourlyData: Array.from(hourMap.entries())
        .map(([hour, stats]) => ({
          hour,
          requestCount: stats.requestCount,
          errorCount: stats.errorCount,
          avgDuration: stats.requestCount > 0 ? stats.totalDuration / stats.requestCount : 0,
          peakMemory: stats.maxMemory
        }))
        .sort((a, b) => a.hour.localeCompare(b.hour))
    }));
  }
}

// Lambda handler
const handlerClass = new LogQueryHandler();
export const handler = handlerClass.handler.bind(handlerClass);
