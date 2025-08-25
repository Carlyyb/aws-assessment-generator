// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const userGroups = ctx.identity.groups || [];
  
  // 权限检查：确保用户是教师或管理员
  const hasPermission = userGroups.includes('teachers') || 
                       userGroups.includes('admin') || 
                       userGroups.includes('super_admin');
  
  if (!hasPermission) {
    util.error('You do not have permission to create knowledge bases', 'Unauthorized');
  }
  
  return {
    operation: 'Invoke',
    payload: ctx,
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  
  return ctx.result;
}
