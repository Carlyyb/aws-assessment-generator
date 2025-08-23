// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
// import { Context } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const userId = ctx.identity.sub;
  return ddb.get({ key: { userId } });
}

export const response = (ctx) => {
  const result = ctx.result;
  
  if (!result) {
    // 如果没有设置记录，返回默认值
    return {
      uiLang: "zh",
      globalLogo: null,
      themeSettings: null
    };
  }
  
  // 如果 uiLang 为 null 值则设为 "zh"
  if (result.uiLang === null || result.uiLang === undefined) {
    result.uiLang = "zh";
  }
  
  // 确保返回的对象包含所有字段
  return {
    uiLang: result.uiLang,
    globalLogo: result.globalLogo || null,
    themeSettings: result.themeSettings || null
  };
};
