// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { courseId } = ctx.args;
  
  if (!courseId) {
    util.error('CourseId is required', 'BadRequest');
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
    util.error(ctx.error.message, ctx.error.type);
  }
  
  return ctx.result;
}
