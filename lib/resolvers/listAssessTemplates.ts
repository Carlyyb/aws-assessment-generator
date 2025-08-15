// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
import { util } from '@aws-appsync/utils';
import { isAdminFromContext, getUserRoleInfo } from '../utils/adminUtils';

export function request(ctx) {
  const userInfo = getUserRoleInfo(ctx);
  
  // 管理员可以看到所有模板，普通用户只能看到自己的
  if (userInfo.isAdmin) {
    // 管理员查询：返回所有评估模板
    return {
      operation: 'Scan',
      // 可以添加过滤条件来限制返回的数据
    };
  } else {
    // 普通用户查询：只返回自己创建的模板
    return {
      operation: 'Query',
      query: {
        expression: 'userId = :userId',
        expressionValues: util.dynamodb.toMapValues({ ':userId': ctx.identity.sub }),
      },
    };
  }
}

export const response = (ctx) => {
  return ctx.result.items;
};
