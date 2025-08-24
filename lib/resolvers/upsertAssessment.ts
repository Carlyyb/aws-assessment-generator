// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const userId = ctx.identity.sub;
  const userEmail = ctx.identity?.claims?.email || ctx.identity?.username;
  const { id, published, ...args } = ctx.args.input;
  const newId = id || util.autoUlid();
  const now = util.time.nowISO8601();
  
  return ddb.put({ 
    key: { userId, id: newId }, 
    item: { 
      ...args, 
      id: newId,
      published: !!published, 
      createdBy: userEmail,
      createdAt: now,
      updatedAt: now
    } 
  });
}

export const response = (ctx) => ctx.result;
