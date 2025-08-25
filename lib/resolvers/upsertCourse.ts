// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const userId = ctx.identity.sub;
  const userName = ctx.identity?.username;
  const userGroups = ctx.identity.groups || [];
  const { id, ...item } = ctx.args.input;
  
  // 权限检查：确保用户是教师或管理员
  const hasPermission = userGroups.includes('teachers') || 
                       userGroups.includes('admin') || 
                       userGroups.includes('super_admin');
  
  if (!hasPermission) {
    util.error('You do not have permission to create or update courses', 'Unauthorized');
  }
  
  const courseId = id || util.autoId();
  
  // 设置默认的 isPublic 值
  const isPublic = item.isPublic !== undefined ? item.isPublic : false;
  
  // 构建要更新的项目
  const courseItem = {
    id: courseId,
    ...item,
    isPublic: isPublic,
    createdBy: userName,
  };
  
  // 如果是新创建的课程，添加 createdAt
  if (!id) {
    courseItem.createdAt = util.time.nowISO8601();
  }
  
  return ddb.put({ 
    key: { id: courseId }, 
    item: courseItem
  });
}

export const response = (ctx) => ctx.result;
