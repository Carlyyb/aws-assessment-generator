// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const { id } = ctx.args.input;
  
  // 如果没有提供ID，说明是创建操作，不需要权限检查
  if (!id) {
    return {};
  }
  
  // 获取现有课程信息以进行权限检查
  return ddb.get({ key: { id } });
}

export function response(ctx) {
  const userName = ctx.identity?.username;
  const userGroups = ctx.identity.groups || [];
  const { id } = ctx.args.input;
  
  // 如果没有提供ID，说明是创建操作，允许继续
  if (!id) {
    return {};
  }
  
  // 如果课程不存在，返回错误
  if (!ctx.result) {
    util.error('Course not found', 'NotFound');
  }
  
  const course = ctx.result;
  const isAdmin = userGroups.includes('admin') || userGroups.includes('super_admin');
  const isOwner = course.createdBy === userName;
  
  // 检查权限：只有课程创建者或管理员可以更新课程
  if (!isOwner && !isAdmin) {
    util.error('Unauthorized to update this course', 'Unauthorized');
  }
  
  // 将现有课程信息传递给下一个函数
  return course;
}
