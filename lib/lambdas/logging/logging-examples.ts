// 示例：如何在Lambda函数中使用结构化日志记录
// 这个示例展示了如何在现有的Lambda函数中添加结构化日志，以便被日志系统收集和分析

import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics } from '@aws-lambda-powertools/metrics';

// 初始化PowerTools
const logger = new Logger({
  serviceName: process.env.POWERTOOLS_SERVICE_NAME || 'your-service-name'
});

const tracer = new Tracer();
const metrics = new Metrics({
  defaultDimensions: {
    service: process.env.POWERTOOLS_SERVICE_NAME || 'your-service-name'
  }
});

// 示例1：基本日志记录
export const basicLogging = async (event: any, context: any) => {
  // 基本信息日志
  logger.info('Function started', {
    requestId: context.awsRequestId,
    functionName: context.functionName,
    remainingTime: context.getRemainingTimeInMillis()
  });

  try {
    // 业务逻辑处理
    const result = await processBusinessLogic(event);
    
    // 成功日志
    logger.info('Function completed successfully', {
      result: result,
      processingTime: Date.now() - Date.parse(context.logStreamName)
    });

    return result;
  } catch (error: any) {
    // 错误日志
    logger.error('Function execution failed', {
      error: error.message,
      errorType: error.constructor.name,
      stackTrace: error.stack,
      requestId: context.awsRequestId
    });

    throw error;
  }
};

// 示例2：用户操作日志
export const userOperationLogging = async (event: any, context: any) => {
  const userId = event.requestContext?.authorizer?.claims?.sub;
  
  // 用户操作开始
  logger.info('User operation started', {
    userId: userId,
    operation: event.httpMethod,
    resource: event.resource,
    userAgent: event.headers?.['User-Agent'],
    sourceIp: event.requestContext?.identity?.sourceIp
  });

  try {
    const startTime = Date.now();
    const result = await processUserRequest(event, userId);
    const duration = Date.now() - startTime;

    // 记录性能指标
    metrics.addMetric('UserOperationDuration', 'Milliseconds', duration);
    metrics.addMetric('UserOperationSuccess', 'Count', 1);

    // 成功日志
    logger.info('User operation completed', {
      userId: userId,
      operation: event.httpMethod,
      duration: duration,
      result: result
    });

    return result;
  } catch (error: any) {
    // 记录错误指标
    metrics.addMetric('UserOperationError', 'Count', 1);

    // 错误日志
    logger.error('User operation failed', {
      userId: userId,
      operation: event.httpMethod,
      error: error.message,
      errorType: error.constructor.name
    });

    throw error;
  } finally {
    // 确保指标被发送
    metrics.publishStoredMetrics();
  }
};

// 示例3：数据库操作日志
export const databaseOperationLogging = async (tableName: string, operation: string, key: any) => {
  const operationId = generateOperationId();
  
  logger.info('Database operation started', {
    operationId: operationId,
    tableName: tableName,
    operation: operation,
    key: key
  });

  try {
    const startTime = Date.now();
    const result = await performDatabaseOperation(tableName, operation, key);
    const duration = Date.now() - startTime;

    // 记录数据库性能指标
    metrics.addMetric('DatabaseOperationDuration', 'Milliseconds', duration);
    metrics.addMetric('DatabaseOperationSuccess', 'Count', 1);

    logger.info('Database operation completed', {
      operationId: operationId,
      tableName: tableName,
      operation: operation,
      duration: duration,
      recordsAffected: result.Count || result.ScannedCount || 1
    });

    return result;
  } catch (error: any) {
    metrics.addMetric('DatabaseOperationError', 'Count', 1);

    logger.error('Database operation failed', {
      operationId: operationId,
      tableName: tableName,
      operation: operation,
      error: error.message,
      errorType: error.constructor.name,
      errorCode: error.code
    });

    throw error;
  }
};

// 示例4：API调用日志
export const apiCallLogging = async (apiName: string, endpoint: string, payload: any) => {
  const correlationId = generateCorrelationId();
  
  logger.info('External API call started', {
    correlationId: correlationId,
    apiName: apiName,
    endpoint: endpoint,
    payloadSize: JSON.stringify(payload).length
  });

  try {
    const startTime = Date.now();
    const response = await callExternalAPI(endpoint, payload);
    const duration = Date.now() - startTime;

    // 记录API调用指标
    metrics.addMetric('ExternalAPICallDuration', 'Milliseconds', duration);
    metrics.addMetric('ExternalAPICallSuccess', 'Count', 1);

    logger.info('External API call completed', {
      correlationId: correlationId,
      apiName: apiName,
      endpoint: endpoint,
      duration: duration,
      statusCode: response.status,
      responseSize: response.data ? JSON.stringify(response.data).length : 0
    });

    return response;
  } catch (error: any) {
    metrics.addMetric('ExternalAPICallError', 'Count', 1);

    logger.error('External API call failed', {
      correlationId: correlationId,
      apiName: apiName,
      endpoint: endpoint,
      error: error.message,
      errorType: error.constructor.name,
      statusCode: error.response?.status,
      responseData: error.response?.data
    });

    throw error;
  }
};

// 示例5：业务事件日志
export const businessEventLogging = (eventType: string, entityId: string, details: any) => {
  logger.info('Business event occurred', {
    eventType: eventType,
    entityId: entityId,
    timestamp: new Date().toISOString(),
    details: details,
    source: 'assessment-generator'
  });

  // 记录业务指标
  metrics.addMetric('BusinessEvent', 'Count', 1);
  metrics.addDimensions({ eventType: eventType });
};

// 辅助函数
function generateOperationId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 模拟函数（在实际使用中替换为真实实现）
async function processBusinessLogic(event: any): Promise<any> {
  // 业务逻辑处理
  return { status: 'success', data: 'processed' };
}

async function processUserRequest(event: any, userId: string): Promise<any> {
  // 用户请求处理
  return { userId: userId, result: 'processed' };
}

async function performDatabaseOperation(tableName: string, operation: string, key: any): Promise<any> {
  // 数据库操作
  return { Count: 1 };
}

async function callExternalAPI(endpoint: string, payload: any): Promise<any> {
  // 外部API调用
  return { status: 200, data: 'response' };
}

// 使用示例
export const exampleHandler = async (event: any, context: any) => {
  // 1. 基本操作日志
  logger.info('Handler started', { 
    event: event, 
    requestId: context.awsRequestId 
  });

  try {
    // 2. 业务事件记录
    businessEventLogging('assessment_generation_requested', event.assessmentId, {
      userId: event.userId,
      templateId: event.templateId
    });

    // 3. 数据库操作
    const assessmentData = await databaseOperationLogging(
      'AssessmentsTable', 
      'getItem', 
      { id: event.assessmentId }
    );

    // 4. 外部API调用
    const aiResponse = await apiCallLogging(
      'OpenAI', 
      'https://api.openai.com/v1/completions',
      { prompt: assessmentData.content }
    );

    // 5. 成功日志
    logger.info('Handler completed successfully', {
      requestId: context.awsRequestId,
      processingTime: context.getRemainingTimeInMillis()
    });

    return {
      statusCode: 200,
      body: JSON.stringify(aiResponse)
    };
  } catch (error: any) {
    // 6. 错误处理
    logger.error('Handler execution failed', {
      error: error.message,
      errorType: error.constructor.name,
      requestId: context.awsRequestId
    });

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

/*
使用建议：

1. 始终记录操作的开始和结束
2. 在错误情况下提供足够的上下文信息
3. 使用结构化数据而不是纯文本消息
4. 记录性能指标以便后续分析
5. 保护敏感信息，避免记录密码、令牌等
6. 使用相关ID（如requestId, correlationId）关联相关日志
7. 为不同类型的操作设置一致的日志格式

注意事项：
- 不要记录敏感信息（密码、API密钥、个人隐私数据）
- 控制日志量，避免产生过多不必要的日志
- 使用适当的日志级别（ERROR, WARN, INFO, DEBUG）
- 考虑日志的成本影响，特别是在高频调用的函数中
*/
