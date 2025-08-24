// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const { id, ...values } = ctx.args.input;
  const userId = ctx.identity.sub;

  // 总是更新 updatedAt 字段
  values.updatedAt = util.time.nowISO8601();

  return ddb.update({
    key: { userId, id },
    update: ddb.operations.replace(values),
  });
}

export const response = (ctx) => ctx.result;
