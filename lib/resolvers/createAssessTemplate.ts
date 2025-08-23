// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const userId = ctx.identity.sub;
  const userEmail = ctx.identity?.claims?.email || ctx.identity?.username;
  const id = util.autoUlid();
  return ddb.put({ 
    key: { userId, id }, 
    item: { 
      id,
      userId,
      ...ctx.args.input, 
      createdBy: userEmail,
      createdAt: util.time.nowISO8601() 
    } 
  });
}

export const response = (ctx) => ctx.result;
