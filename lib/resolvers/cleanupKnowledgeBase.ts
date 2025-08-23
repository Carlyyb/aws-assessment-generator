// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  // 从stash中获取课程ID
  const courseId = ctx.stash.courseId;
  
  if (!courseId) {
    // 如果没有课程ID，返回默认成功结果（可能课程没有关联知识库）
    return {
      operation: 'NO_OP'
    };
  }
  
  return {
    operation: 'Invoke',
    payload: {
      arguments: {
        courseId
      }
    }
  };
}

export function response(ctx) {
  if (ctx.error) {
    // 知识库删除失败不应该影响课程删除的结果
    // 记录错误但继续返回课程删除成功
    console.error('删除知识库时发生错误:', ctx.error);
    util.appendError(ctx.error.message, ctx.error.type);
  }
  
  // 无论知识库删除是否成功，都返回课程删除成功的结果
  return ctx.prev.result;
}
