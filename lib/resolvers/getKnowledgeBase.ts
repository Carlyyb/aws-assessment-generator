// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const userId = ctx.identity.sub;
  const { courseId } = ctx.args;
  
  if (!userId) {
    util.error('User not authenticated', 'Unauthorized');
  }
  
  if (!courseId) {
    util.error('CourseId is required', 'BadRequest');
  }
  
  // 使用复合键查询知识库
  const key = {
    userId: userId,
    courseId: courseId
  };
  
  return ddb.get({ key });
}

export const response = (ctx) => {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  return ctx.result;
};
