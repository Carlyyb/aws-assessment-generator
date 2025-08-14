// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { CloudWatchLogsEvent, CloudWatchLogsDecodedData, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { gunzipSync } from 'zlib';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';

const ddbClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(ddbClient);

const logger = new Logger({
  serviceName: process.env.POWERTOOLS_SERVICE_NAME || 'log-aggregator'
});

const tracer = new Tracer();

interface ParsedLogEntry {
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
  metricType: string;
  value: number;
  timestamp: string;
  dimensions: Record<string, string>;
}

class LogAggregator implements LambdaInterface {
  @tracer.captureLambdaHandler()
  async handler(event: CloudWatchLogsEvent, context: Context): Promise<void> {
    try {
      // 解压缩CloudWatch Logs数据
      const payload = Buffer.from(event.awslogs.data, 'base64');
      const decompressed = gunzipSync(payload);
      const logData: CloudWatchLogsDecodedData = JSON.parse(decompressed.toString('utf8'));

      logger.info('Processing log events', { 
        logGroup: logData.logGroup,
        logStream: logData.logStream,
        eventCount: logData.logEvents.length 
      });

      const logEntries: ParsedLogEntry[] = [];
      const metrics: SystemMetric[] = [];

      // 处理每个日志事件
      for (const logEvent of logData.logEvents) {
        try {
          const parsedEntry = this.parseLogMessage(logEvent.message, logData.logGroup, logEvent.timestamp);
          if (parsedEntry) {
            logEntries.push(parsedEntry);
            
            // 提取系统指标
            const extractedMetrics = this.extractMetrics(parsedEntry, logData.logGroup);
            metrics.push(...extractedMetrics);
          }
        } catch (error: any) {
          logger.warn('Failed to parse log entry', { 
            message: logEvent.message, 
            error: error?.message || 'Unknown error'
          });
        }
      }

      // 批量存储日志条目
      await this.storeLogEntries(logEntries);
      
      // 批量存储指标
      await this.storeMetrics(metrics);

      logger.info('Successfully processed log events', { 
        processedEntries: logEntries.length,
        processedMetrics: metrics.length 
      });

    } catch (error: any) {
      logger.error('Failed to process CloudWatch logs', { error: error?.message || 'Unknown error' });
      throw error;
    }
  }

  private parseLogMessage(message: string, logGroup: string, timestamp: number): ParsedLogEntry | null {
    try {
      // 尝试解析为JSON格式的结构化日志
      const jsonLog = JSON.parse(message);
      
      return {
        timestamp: new Date(timestamp).toISOString(),
        message: jsonLog.message || message,
        level: jsonLog.level || this.inferLogLevel(message),
        serviceName: jsonLog.service || this.extractServiceName(logGroup),
        userId: jsonLog.userId || jsonLog.user_id,
        requestId: jsonLog.requestId || jsonLog.request_id || jsonLog.correlation_id,
        errorType: jsonLog.errorType || jsonLog.error_type,
        stackTrace: jsonLog.stackTrace || jsonLog.stack_trace,
        duration: jsonLog.duration,
        memoryUsed: jsonLog.memoryUsed || jsonLog.memory_used,
        billedDuration: jsonLog.billedDuration || jsonLog.billed_duration
      };
    } catch {
      // 如果不是JSON格式，则解析文本格式日志
      return this.parseTextLog(message, logGroup, timestamp);
    }
  }

  private parseTextLog(message: string, logGroup: string, timestamp: number): ParsedLogEntry | null {
    // 解析Lambda报告格式: REPORT RequestId: xxx Duration: xxx ms Billed Duration: xxx ms Memory Size: xxx MB Max Memory Used: xxx MB
    const reportMatch = message.match(/REPORT RequestId: ([\w-]+)\s+Duration: ([\d.]+) ms\s+Billed Duration: ([\d.]+) ms.*Max Memory Used: ([\d.]+) MB/);
    if (reportMatch) {
      return {
        timestamp: new Date(timestamp).toISOString(),
        message: 'Lambda execution report',
        level: 'INFO',
        serviceName: this.extractServiceName(logGroup),
        requestId: reportMatch[1],
        duration: parseFloat(reportMatch[2]),
        billedDuration: parseFloat(reportMatch[3]),
        memoryUsed: parseFloat(reportMatch[4])
      };
    }

    // 解析错误日志
    const errorMatch = message.match(/ERROR|Error|error/);
    if (errorMatch) {
      return {
        timestamp: new Date(timestamp).toISOString(),
        message: message,
        level: 'ERROR',
        serviceName: this.extractServiceName(logGroup),
        errorType: this.extractErrorType(message),
        stackTrace: this.extractStackTrace(message)
      };
    }

    // 普通日志
    return {
      timestamp: new Date(timestamp).toISOString(),
      message: message,
      level: this.inferLogLevel(message),
      serviceName: this.extractServiceName(logGroup)
    };
  }

  private inferLogLevel(message: string): string {
    if (message.includes('ERROR') || message.includes('Error') || message.includes('error')) return 'ERROR';
    if (message.includes('WARN') || message.includes('Warning') || message.includes('warning')) return 'WARN';
    if (message.includes('INFO') || message.includes('Info')) return 'INFO';
    if (message.includes('DEBUG') || message.includes('Debug')) return 'DEBUG';
    return 'INFO';
  }

  private extractServiceName(logGroup: string): string {
    // 从日志组名称提取服务名称
    // 例如: /aws/lambda/gen-assess-stack-questions-generator -> questions-generator
    const match = logGroup.match(/\/aws\/lambda\/.*?([^-]*-[^-]*|[^-]*)$/);
    return match ? match[1] : 'unknown';
  }

  private extractErrorType(message: string): string | undefined {
    const errorMatch = message.match(/(\w+Error|\w+Exception)/);
    return errorMatch ? errorMatch[1] : undefined;
  }

  private extractStackTrace(message: string): string | undefined {
    if (message.includes('at ') && message.includes('.js:')) {
      return message;
    }
    return undefined;
  }

  private extractMetrics(logEntry: ParsedLogEntry, logGroup: string): SystemMetric[] {
    const metrics: SystemMetric[] = [];
    const timestamp = logEntry.timestamp;
    const serviceName = logEntry.serviceName || 'unknown';

    // Lambda性能指标
    if (logEntry.duration) {
      metrics.push({
        metricType: 'lambda_duration',
        value: logEntry.duration,
        timestamp,
        dimensions: { service: serviceName, logGroup }
      });
    }

    if (logEntry.memoryUsed) {
      metrics.push({
        metricType: 'lambda_memory_used',
        value: logEntry.memoryUsed,
        timestamp,
        dimensions: { service: serviceName, logGroup }
      });
    }

    if (logEntry.billedDuration) {
      metrics.push({
        metricType: 'lambda_billed_duration',
        value: logEntry.billedDuration,
        timestamp,
        dimensions: { service: serviceName, logGroup }
      });
    }

    // 错误计数
    if (logEntry.level === 'ERROR') {
      metrics.push({
        metricType: 'error_count',
        value: 1,
        timestamp,
        dimensions: { 
          service: serviceName, 
          logGroup,
          errorType: logEntry.errorType || 'unknown'
        }
      });
    }

    // 用户活动指标
    if (logEntry.userId) {
      metrics.push({
        metricType: 'user_activity',
        value: 1,
        timestamp,
        dimensions: { 
          service: serviceName,
          userId: logEntry.userId
        }
      });
    }

    return metrics;
  }

  private async storeLogEntries(logEntries: ParsedLogEntry[]): Promise<void> {
    const batchPromises = logEntries.map(async (entry) => {
      const ttl = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30天后过期
      
      const command = new PutCommand({
        TableName: process.env.LOG_ANALYTICS_TABLE!,
        Item: {
          logId: uuidv4(),
          timestamp: entry.timestamp,
          message: entry.message,
          level: entry.level,
          serviceName: entry.serviceName,
          userId: entry.userId,
          requestId: entry.requestId,
          errorType: entry.errorType,
          stackTrace: entry.stackTrace,
          duration: entry.duration,
          memoryUsed: entry.memoryUsed,
          billedDuration: entry.billedDuration,
          ttl
        }
      });

      try {
        await docClient.send(command);
      } catch (error: any) {
        logger.warn('Failed to store log entry', { error: error?.message || 'Unknown error', entry });
      }
    });

    await Promise.allSettled(batchPromises);
  }

  private async storeMetrics(metrics: SystemMetric[]): Promise<void> {
    const aggregatedMetrics = this.aggregateMetrics(metrics);
    
    const batchPromises = aggregatedMetrics.map(async (metric) => {
      const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90天后过期
      const metricKey = `${metric.metricType}#${JSON.stringify(metric.dimensions)}`;
      
      const command = new UpdateCommand({
        TableName: process.env.SYSTEM_METRICS_TABLE!,
        Key: {
          metricKey,
          timestamp: metric.timestamp
        },
        UpdateExpression: 'ADD #value :value SET #metricType = :metricType, #dimensions = :dimensions, #ttl = :ttl',
        ExpressionAttributeNames: {
          '#value': 'value',
          '#metricType': 'metricType',
          '#dimensions': 'dimensions',
          '#ttl': 'ttl'
        },
        ExpressionAttributeValues: {
          ':value': metric.value,
          ':metricType': metric.metricType,
          ':dimensions': metric.dimensions,
          ':ttl': ttl
        }
      });

      try {
        await docClient.send(command);
      } catch (error: any) {
        logger.warn('Failed to store metric', { error: error?.message || 'Unknown error', metric });
      }
    });

    await Promise.allSettled(batchPromises);
  }

  private aggregateMetrics(metrics: SystemMetric[]): SystemMetric[] {
    // 将指标按分钟聚合
    const aggregated = new Map<string, SystemMetric>();
    
    metrics.forEach(metric => {
      // 将时间戳向下舍入到分钟
      const roundedTimestamp = new Date(metric.timestamp);
      roundedTimestamp.setSeconds(0, 0);
      const timeKey = roundedTimestamp.toISOString();
      
      const key = `${metric.metricType}#${JSON.stringify(metric.dimensions)}#${timeKey}`;
      
      if (aggregated.has(key)) {
        const existing = aggregated.get(key)!;
        existing.value += metric.value;
      } else {
        aggregated.set(key, {
          ...metric,
          timestamp: timeKey
        });
      }
    });
    
    return Array.from(aggregated.values());
  }
}

// Lambda handler
const handlerClass = new LogAggregator();
export const handler = handlerClass.handler.bind(handlerClass);
