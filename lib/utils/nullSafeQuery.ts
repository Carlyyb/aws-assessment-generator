// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 空值安全查询工具
 * 用于防止GraphQL "Cannot return null for non-nullable type" 错误
 */

import { DynamoDBClient, GetItemCommand, QueryCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

/**
 * DynamoDB查询结果的空值安全包装器
 */
export class NullSafeQueryResult<T = any> {
  constructor(
    private readonly item: T | null | undefined,
    private readonly tableName: string,
    private readonly operation: string
  ) {}

  /**
   * 获取查询结果，如果为空则抛出明确的错误
   */
  getOrThrow(itemType: string = 'Item'): T {
    if (!this.item) {
      throw new Error(`${itemType} not found in ${this.tableName} (operation: ${this.operation})`);
    }
    return this.item;
  }

  /**
   * 获取查询结果，如果为空则返回默认值
   */
  getOrDefault(defaultValue: T): T {
    return this.item ?? defaultValue;
  }

  /**
   * 获取查询结果，允许为空
   */
  getOrNull(): T | null {
    return this.item ?? null;
  }

  /**
   * 检查是否存在
   */
  exists(): boolean {
    return this.item != null;
  }
}

/**
 * 空值安全的GetItem操作
 */
export async function nullSafeGetItem<T = any>(
  client: DynamoDBClient,
  tableName: string,
  key: Record<string, any>,
  options?: {
    projectionExpression?: string;
    expressionAttributeNames?: Record<string, string>;
  }
): Promise<NullSafeQueryResult<T>> {
  const command = new GetItemCommand({
    TableName: tableName,
    Key: marshall(key),
    ProjectionExpression: options?.projectionExpression,
    ExpressionAttributeNames: options?.expressionAttributeNames,
  });

  const result = await client.send(command);
  const item = result.Item ? (unmarshall(result.Item) as T) : null;
  
  return new NullSafeQueryResult(item, tableName, 'GetItem');
}

/**
 * 空值安全的Query操作
 */
export async function nullSafeQuery<T = any>(
  client: DynamoDBClient,
  tableName: string,
  keyConditionExpression: string,
  options?: {
    indexName?: string;
    filterExpression?: string;
    projectionExpression?: string;
    expressionAttributeNames?: Record<string, string>;
    expressionAttributeValues?: Record<string, any>;
    limit?: number;
    scanIndexForward?: boolean;
  }
): Promise<NullSafeQueryResult<T[]>> {
  const command = new QueryCommand({
    TableName: tableName,
    IndexName: options?.indexName,
    KeyConditionExpression: keyConditionExpression,
    FilterExpression: options?.filterExpression,
    ProjectionExpression: options?.projectionExpression,
    ExpressionAttributeNames: options?.expressionAttributeNames,
    ExpressionAttributeValues: options?.expressionAttributeValues ? marshall(options.expressionAttributeValues) : undefined,
    Limit: options?.limit,
    ScanIndexForward: options?.scanIndexForward,
  });

  const result = await client.send(command);
  const items = result.Items ? result.Items.map(item => unmarshall(item) as T) : [];
  
  return new NullSafeQueryResult(items, tableName, 'Query');
}

/**
 * 空值安全的Query操作，获取第一项
 */
export async function nullSafeQueryFirst<T = any>(
  client: DynamoDBClient,
  tableName: string,
  keyConditionExpression: string,
  options?: Parameters<typeof nullSafeQuery>[3]
): Promise<NullSafeQueryResult<T>> {
  const queryOptions = { ...options, limit: 1 };
  const result = await nullSafeQuery<T>(client, tableName, keyConditionExpression, queryOptions);
  const items = result.getOrDefault([]);
  const firstItem = items.length > 0 ? items[0] : null;
  
  return new NullSafeQueryResult(firstItem, tableName, 'QueryFirst');
}

/**
 * Assessment特定的默认值填充
 */
export function fillAssessmentDefaults(assessment: any): any {
  if (!assessment) return null;
  
  return {
    ...assessment,
    // 为可能缺失的字段提供默认值
    name: assessment.name || '未命名测试',
    updatedAt: assessment.updatedAt || new Date().toISOString(),
    lectureDate: assessment.lectureDate || null,
    deadline: assessment.deadline || null,
    published: assessment.published ?? false,
    status: assessment.status || 'CREATED',
    multiChoiceAssessment: assessment.multiChoiceAssessment || [],
    freeTextAssessment: assessment.freeTextAssessment || [],
    trueFalseAssessment: assessment.trueFalseAssessment || [],
    singleAnswerAssessment: assessment.singleAnswerAssessment || [],
    // 扩展字段默认值
    timeLimited: assessment.timeLimited ?? false,
    timeLimit: assessment.timeLimit ?? 120,
    allowAnswerChange: assessment.allowAnswerChange ?? true,
    studentGroups: assessment.studentGroups || ['ALL'],
    courses: assessment.courses || (assessment.courseId ? [assessment.courseId] : []),
    attemptLimit: assessment.attemptLimit ?? 1,
    scoreMethod: assessment.scoreMethod || 'highest'
  };
}

/**
 * StudentAssessment特定的默认值填充
 */
export function fillStudentAssessmentDefaults(studentAssessment: any): any {
  if (!studentAssessment) return null;
  
  return {
    ...studentAssessment,
    // 为可能缺失的字段提供默认值
    answers: studentAssessment.answers || '{}',
    completed: studentAssessment.completed ?? false,
    score: studentAssessment.score ?? null,
    report: studentAssessment.report || null,
    updatedAt: studentAssessment.updatedAt || new Date().toISOString(),
    // 扩展字段默认值
    attemptCount: studentAssessment.attemptCount ?? 0,
    duration: studentAssessment.duration ?? null,
    scores: studentAssessment.scores || [],
    remainingAttempts: studentAssessment.remainingAttempts ?? 1
  };
}

/**
 * 通用的字段默认值填充函数
 */
export function fillRequiredFields<T extends Record<string, any>>(
  item: T | null | undefined,
  fieldDefaults: Partial<T>
): T | null {
  if (!item) return null;
  
  const result = { ...item } as Record<string, any>;
  
  // 为每个定义的默认字段填充值
  for (const [key, defaultValue] of Object.entries(fieldDefaults)) {
    if (result[key] === null || result[key] === undefined) {
      result[key] = defaultValue;
    }
  }
  
  return result as T;
}
