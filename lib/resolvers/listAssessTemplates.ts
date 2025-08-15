// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
import { util } from '@aws-appsync/utils';

export function request(ctx) {
  // 所有用户都能看到所有模板
  return {
    operation: 'Scan',
    // 可以添加过滤条件来限制返回的数据
  };
}

export const response = (ctx) => {
  return ctx.result.items;
};
