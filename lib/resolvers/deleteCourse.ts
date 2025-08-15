// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const { id } = ctx.args;
  return ddb.remove({ key: { id } });
}

export const response = (ctx) => {
  if (ctx.error) {
    return false;
  }
  return true;
};
