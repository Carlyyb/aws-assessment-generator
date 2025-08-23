// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as ddb from '@aws-appsync/utils/dynamodb';
import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { id } = ctx.args;
  return ddb.remove({ key: { id } });
}

export const response = (ctx) => {
  if (ctx.error) {
    return false;
  }
  
  // 课程删除成功后，将课程ID传递给下一个resolver来删除知识库
  ctx.stash.courseId = ctx.args.id;
  
  return true;
};
