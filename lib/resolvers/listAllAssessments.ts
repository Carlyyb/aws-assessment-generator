// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
import { util } from '@aws-appsync/utils';

export function request(ctx) {

  // 管理员可以查看所有评估，不需要用户过滤
  return {
    operation: 'Scan',
    // 不添加任何过滤器，扫描所有记录
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
