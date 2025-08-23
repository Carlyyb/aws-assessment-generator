// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 班级管理 AppSync Resolver
 * 调用对应的 Lambda 函数处理班级相关操作
 */

export function request(ctx) {
  return {
    operation: 'Invoke',
    payload: ctx,
  };
}

export function response(ctx) {
  return ctx.result;
}
