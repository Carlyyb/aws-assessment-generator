// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
 
import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const userId = ctx.identity.sub;
  const userEmail = ctx.identity?.claims?.email || ctx.identity?.username;
  const { id, published, ...args } = ctx.args.input;
  
  return ddb.put({ 
    key: { userId, id: id || util.autoUlid() }, 
    item: { 
      ...args, 
      id: id || util.autoUlid(),
      published: !!published, 
      createdBy: userEmail,
      updatedAt: util.time.nowISO8601() 
    } 
  });
}

export const response = (ctx) => ctx.result;
