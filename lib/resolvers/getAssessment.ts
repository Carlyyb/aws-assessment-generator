// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const userId = ctx.identity.sub;
  return ddb.get({ key: { userId, id: ctx.args.id } });
}

export const response = (ctx) => {
  const result = ctx.result;
  if (!result) return result;
  
  // 简单的内联数据转换，处理 DynamoDB 格式
  const transform = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    // 处理 DynamoDB 数据类型
    if (obj.S !== undefined) return obj.S;
    if (obj.N !== undefined) return parseInt(obj.N);
    if (obj.BOOL !== undefined) return obj.BOOL;
    if (obj.L !== undefined) return obj.L.map(item => transform(item));
    if (obj.M !== undefined) {
      const transformed = {};
      for (const [key, value] of Object.entries(obj.M)) {
        transformed[key] = transform(value);
      }
      return transformed;
    }
    
    // 处理普通对象
    if (Array.isArray(obj)) {
      return obj.map(item => transform(item));
    }
    
    const transformed = {};
    for (const [key, value] of Object.entries(obj)) {
      transformed[key] = transform(value);
    }
    return transformed;
  };
  
  return transform(result);
};
