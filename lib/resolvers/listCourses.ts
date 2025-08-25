// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const userName = ctx.identity?.username;
  const userGroups = ctx.identity.groups || [];
  const isAdmin = userGroups.includes('admin') || userGroups.includes('super_admin');
  
  // 管理员和超级管理员可以查看所有课程
  if (isAdmin) {
    return ddb.scan({});
  }
  
  // 普通用户（教师/学生）只能看到自己创建的课程或公开的课程
  // 由于 DynamoDB 不支持复杂的 OR 查询，我们需要扫描所有记录并在应用层过滤
  return ddb.scan({});
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  
  const userName = ctx.identity?.username;
  const userGroups = ctx.identity.groups || [];
  const isAdmin = userGroups.includes('admin') || userGroups.includes('super_admin');
  
  // 管理员可以看到所有课程
  if (isAdmin) {
    return ctx.result.items;
  }
  
  // 过滤课程：只返回用户创建的课程或公开的课程
  const filteredCourses = ctx.result.items.filter(course => {
    return course.createdBy === userName || course.isPublic === true;
  });
  
  return filteredCourses;
}
