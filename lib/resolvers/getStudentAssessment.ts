// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const userId = ctx.identity.sub;
  return ddb.get({ key: { userId, parentAssessId: ctx.args.parentAssessId } });
}

export function response(ctx) {
  const userId = ctx.identity.sub;
  const parentAssessId = ctx.args.parentAssessId;
  
  // 如果StudentAssessment记录存在，直接返回
  if (ctx.result) {
    return ctx.result;
  }
  
  // 如果StudentAssessment记录不存在，创建一个初始记录
  // 这将触发后续的assessment字段解析器来获取完整的assessment数据
  console.log('创建初始学生测试记录');
  return {
    userId: userId,
    parentAssessId: parentAssessId,
    answers: null,
    completed: false,
    score: null,
    report: null,
    updatedAt: null,
    // assessment字段将由ParentAssessmentResolver解析
    assessment: null
  };
}
