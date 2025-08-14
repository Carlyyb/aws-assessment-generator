// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { DynamoDBStreamEvent, Context } from 'aws-lambda';
import { LambdaInterface } from '@aws-lambda-powertools/commons/types';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';

const logger = new Logger({
  serviceName: process.env.POWERTOOLS_SERVICE_NAME || 'error-alert'
});

const tracer = new Tracer();

interface AlertRule {
  metricType: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq';
  windowMinutes: number;
}

const ALERT_RULES: AlertRule[] = [
  { metricType: 'error_count', threshold: 10, operator: 'gt', windowMinutes: 5 },
  { metricType: 'lambda_duration', threshold: 30000, operator: 'gt', windowMinutes: 5 }, // 30秒
  { metricType: 'lambda_memory_used', threshold: 400, operator: 'gt', windowMinutes: 5 } // 400MB
];

class ErrorAlertHandler implements LambdaInterface {
  @tracer.captureLambdaHandler()
  async handler(event: DynamoDBStreamEvent, context: Context): Promise<void> {
    try {
      logger.info('Processing DynamoDB stream records', { recordCount: event.Records.length });

      for (const record of event.Records) {
        if (record.eventName === 'INSERT' && record.dynamodb?.NewImage) {
          await this.processMetricRecord(record.dynamodb.NewImage);
        }
      }
    } catch (error: any) {
      logger.error('Failed to process alert', { error: error?.message || 'Unknown error' });
      throw error;
    }
  }

  private async processMetricRecord(record: any): Promise<void> {
    try {
      const metricType = record.metricType?.S;
      const value = parseFloat(record.value?.N || '0');
      const timestamp = record.timestamp?.S;
      const dimensions = record.dimensions?.M ? this.parseDimensions(record.dimensions.M) : {};

      if (!metricType || !timestamp) {
        return;
      }

      // 检查是否触发告警规则
      for (const rule of ALERT_RULES) {
        if (metricType === rule.metricType) {
          const shouldAlert = this.evaluateRule(rule, value);
          
          if (shouldAlert) {
            await this.sendAlert(rule, value, timestamp, dimensions);
          }
        }
      }
    } catch (error: any) {
      logger.warn('Failed to process metric record', { error: error?.message || 'Unknown error', record });
    }
  }

  private parseDimensions(dimensionsRecord: any): Record<string, string> {
    const dimensions: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(dimensionsRecord)) {
      if (typeof value === 'object' && value !== null && 'S' in value) {
        dimensions[key] = (value as any).S;
      }
    }
    
    return dimensions;
  }

  private evaluateRule(rule: AlertRule, value: number): boolean {
    switch (rule.operator) {
      case 'gt':
        return value > rule.threshold;
      case 'lt':
        return value < rule.threshold;
      case 'eq':
        return value === rule.threshold;
      default:
        return false;
    }
  }

  private async sendAlert(rule: AlertRule, value: number, timestamp: string, dimensions: Record<string, string>): Promise<void> {
    const alertMessage = this.formatAlertMessage(rule, value, timestamp, dimensions);
    
    // 记录告警信息到日志（生产环境可以集成SNS、Slack等）
    logger.warn('Alert triggered', { 
      rule: rule.metricType, 
      value, 
      timestamp, 
      dimensions,
      message: alertMessage 
    });

    // 这里可以添加实际的通知逻辑
    console.log(`ALERT: ${alertMessage}`);
  }

  private formatAlertMessage(rule: AlertRule, value: number, timestamp: string, dimensions: Record<string, string>): string {
    const service = dimensions.service || 'Unknown Service';
    const logGroup = dimensions.logGroup || 'Unknown LogGroup';
    
    let message = `🚨 Assessment Generator Alert\n\n`;
    message += `Metric: ${rule.metricType}\n`;
    message += `Current Value: ${value}\n`;
    message += `Threshold: ${rule.threshold}\n`;
    message += `Service: ${service}\n`;
    message += `Log Group: ${logGroup}\n`;
    message += `Timestamp: ${timestamp}\n\n`;
    
    // 根据指标类型添加具体的建议
    switch (rule.metricType) {
      case 'error_count':
        message += `High error rate detected in ${service}. Please check the application logs for detailed error information.`;
        break;
      case 'lambda_duration':
        message += `Function execution time is high (${value}ms). Consider optimizing the function or increasing memory allocation.`;
        break;
      case 'lambda_memory_used':
        message += `High memory usage detected (${value}MB). Consider increasing memory allocation or optimizing memory usage.`;
        break;
      default:
        message += `Please investigate the ${service} service.`;
    }
    
    return message;
  }
}

// Lambda handler
const handlerClass = new ErrorAlertHandler();
export const handler = handlerClass.handler.bind(handlerClass);
