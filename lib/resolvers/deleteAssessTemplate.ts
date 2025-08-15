// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';
import { isAdminFromContext, getUserRoleInfo } from '../utils/adminUtils';

export function request(ctx) {
  const { id } = ctx.args;
  const userInfo = getUserRoleInfo(ctx);
  
  // 检查权限：管理员可以删除任何模板，普通用户只能删除自己的模板
  if (userInfo.isAdmin) {
    // 管理员可以直接删除
    return {
      operation: 'DeleteItem',
      key: util.dynamodb.toMapValues({ id })
    };
  } else {
    // 普通用户删除时需要验证所有权
    // 使用条件删除，只有当 userId 匹配时才删除
    return {
      operation: 'DeleteItem',
      key: util.dynamodb.toMapValues({ id }),
      condition: {
        expression: 'userId = :userId',
        expressionValues: util.dynamodb.toMapValues({ ':userId': ctx.identity.sub })
      }
    };
  }
}

export const response = (ctx) => {
  if (ctx.error) {
    // 如果是条件检查失败，返回权限错误
    if (ctx.error.type === 'DynamoDB:ConditionalCheckFailedException') {
      util.error('Permission denied or template not found', 'Unauthorized');
    }
    return false;
  }
  return true;
};
