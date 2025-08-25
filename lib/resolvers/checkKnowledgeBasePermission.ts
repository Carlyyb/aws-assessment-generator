// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const { courseId } = ctx.args.input || ctx.args;
  
  if (!courseId) {
    util.error('Course ID is required', 'BadRequest');
  }
  
  // 获取课程信息以检查权限
  return ddb.get({ key: { id: courseId } });
}

export function response(ctx) {
  const userName = ctx.identity?.username;
  const userGroups = ctx.identity.groups || [];
  const { courseId } = ctx.args.input || ctx.args;
  
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  
  if (!ctx.result) {
    util.error('Course not found', 'NotFound');
  }
  
  const course = ctx.result;
  const isAdmin = userGroups.includes('admin') || userGroups.includes('super_admin');
  const isOwner = course.createdBy === userName;
  const isPublic = course.isPublic === true;
  
  // 检查权限：课程创建者、管理员、或公开课程的任何教师都可以管理知识库
  const hasTeacherPermission = userGroups.includes('teachers') || userGroups.includes('admin') || userGroups.includes('super_admin');
  
  if (!isOwner && !isAdmin && !(isPublic && hasTeacherPermission)) {
    util.error('Unauthorized to manage knowledge base for this course', 'Unauthorized');
  }
  
  // 将课程信息传递给下一个函数
  return course;
}
