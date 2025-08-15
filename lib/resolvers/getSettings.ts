// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
// import { Context } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';
import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const userId = ctx.identity.sub;
  
  if (!userId) {
    util.error('User not authenticated', 'Unauthorized');
  }
  
  return ddb.get({ key: { userId } });
}

export const response = (ctx) => {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  
  let result = ctx.result;
  
  // 如果没有设置记录，创建默认设置
  if (!result) {
    result = {
      userId: ctx.identity.sub,
      lang: 'zh',
      theme: 'default',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log('Created default settings for user ' + ctx.identity.sub);
    return result;
  }
  
  // 数据清理和验证
  let dataUpdated = false;
  const validLanguages = ['zh', 'en'];
  const validThemes = ['default', 'dark', 'light'];
  
  // 验证和修复语言设置
  if (!result.lang || validLanguages.indexOf(result.lang) === -1) {
    const oldLang = result.lang;
    result.lang = 'zh'; // 默认中文
    dataUpdated = true;
    console.log('Invalid language "' + oldLang + '" found for user ' + result.userId + ', set to default "zh"');
  }
  
  // 验证和修复主题设置
  if (!result.theme || validThemes.indexOf(result.theme) === -1) {
    const oldTheme = result.theme;
    result.theme = 'default';
    dataUpdated = true;
    console.log('Invalid theme "' + oldTheme + '" found for user ' + result.userId + ', set to default "default"');
  }
  
  // 确保必需的时间戳字段存在
  if (!result.createdAt) {
    result.createdAt = new Date().toISOString();
    dataUpdated = true;
  }
  
  if (!result.updatedAt) {
    result.updatedAt = new Date().toISOString();
    dataUpdated = true;
  }
  
  // 如果数据被修复，记录日志
  if (dataUpdated) {
    console.log('Settings data cleaned for user ' + result.userId + ': ' + JSON.stringify(result));
    
    // 这里可以触发一个异步更新来持久化修复的数据
    // 或者记录需要清理的记录ID供后续批处理
  }
  
  return result;
};
