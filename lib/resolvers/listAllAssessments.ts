// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
import { util } from '@aws-appsync/utils';

export function request(ctx) {
  // 读取用户组（兼容两种位置）
  const groups = Array.isArray(ctx.identity?.groups)
    ? ctx.identity.groups
    : (Array.isArray(ctx.identity?.claims?.['cognito:groups']) ? ctx.identity.claims['cognito:groups'] : []);

  const isAdmin = groups.includes('admin') || groups.includes('super_admin');

  // 管理员可以查看所有测试；非管理员仅能查看自己的测试（兜底安全）
  if (isAdmin) {
    return {
      operation: 'Scan',
    };
  }

  return {
    operation: 'Scan',
    filter: {
      expression: 'userId = :userId',
      expressionValues: util.dynamodb.toMapValues({ ':userId': ctx.identity?.sub }),
    },
  };
}

export function response(ctx) {
  console.log("listAllAssessments", ctx);
  // 检查是否有错误
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  
  // 检查结果是否存在
  if (!ctx.result || !ctx.result.items) {
    return []; // 如果没有结果，返回空数组
  }
  
  // 返回 DynamoDB 扫描结果中的 items 数组
  return ctx.result.items;
}
