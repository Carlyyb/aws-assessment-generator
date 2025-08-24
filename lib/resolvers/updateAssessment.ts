// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const { id, ...values } = ctx.args.input;
  const userId = ctx.identity.sub;

  const expressionNames = {};
  const expressionValues = {};
  let updateExpression = 'SET';

  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined) {
      const expressionKey = `#${key}`;
      const expressionValue = `:${key}`;
      updateExpression += ` ${expressionKey} = ${expressionValue},`;
      expressionNames[expressionKey] = key;
      expressionValues[expressionValue] = value;
    }
  }

  // Always update the updatedAt field
  const updatedAtKey = '#updatedAt';
  const updatedAtValue = ':updatedAt';
  expressionNames[updatedAtKey] = 'updatedAt';
  expressionValues[updatedAtValue] = util.time.nowISO8601();
  updateExpression += ` ${updatedAtKey} = ${updatedAtValue}`;

  return ddb.update({
    key: { userId, id },
    update: {
      expression: updateExpression,
      expressionNames,
      expressionValues: util.dynamodb.toMapValues(expressionValues),
    },
  });
}

export const response = (ctx) => ctx.result;
