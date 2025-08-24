import { util } from '@aws-appsync/utils';

// 使用 GSI ParentAssessIdIndex 按 parentAssessId 查询所有学生作答结果
export function request(ctx) {
  const { parentAssessId } = ctx.args;

  if (!ctx.identity) {
    throw new Error("Identity information is missing");
  }

  let groups = [];
  if (Array.isArray(ctx.identity?.groups)) {
    groups = ctx.identity.groups;
  } else if (Array.isArray(ctx.identity?.claims?.['cognito:groups'])) {
    groups = ctx.identity.claims['cognito:groups'];
  }

  // 管理员/教师均可查看所有学生结果
  const isPrivileged = groups.includes('admin') || groups.includes('super_admin') || groups.includes('teachers');

  // 基于 GSI ParentAssessIdIndex 按 parentAssessId 查询（按权限决定是否追加过滤）
  if (isPrivileged) {
    return {
      operation: 'Query',
      index: 'ParentAssessIdIndex',
      query: {
        expression: 'parentAssessId = :pid',
        expressionValues: util.dynamodb.toMapValues({ ':pid': parentAssessId }),
      },
    };
  }

  // 非特权用户仅能查看自己的记录
  else{
    return {
      operation: 'Query',
      index: 'ParentAssessIdIndex',
      query: {
        expression: 'parentAssessId = :pid',
        expressionValues: util.dynamodb.toMapValues({ ':pid': parentAssessId }),
      },
      filter: {
        expression: 'userId = :uid',
        expressionValues: util.dynamodb.toMapValues({ ':uid': ctx.identity.sub }),
      },
    };
  }
}
export function response(ctx) {
  // 返回查询结果
  return ctx.result?.items ?? [];
}
