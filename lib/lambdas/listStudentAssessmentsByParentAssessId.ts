import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { Handler } from 'aws-lambda';
import { fillStudentAssessmentDefaults } from '../utils/nullSafeQuery';

const region = process.env.region!;
const studentAssessmentsTable = process.env.studentAssessmentsTable!;

const dynamo = new DynamoDBClient({ region });

export const handler: Handler = async (event) => {
  console.log('listStudentAssessmentsByParentAssessId invoked', JSON.stringify(event?.ctx?.arguments));

  const parentAssessId: string | undefined = event?.ctx?.arguments?.parentAssessId;
  if (!parentAssessId) {
    return [];
  }

  // 解析用户组
  let groups: string[] = [];
  const idt = event?.ctx?.identity || {};
  if (Array.isArray(idt?.groups)) groups = idt.groups as string[];
  else if (Array.isArray(idt?.claims?.['cognito:groups'])) groups = idt.claims['cognito:groups'] as string[];
  else if (typeof idt?.claims?.['cognito:groups'] === 'string') groups = [idt.claims['cognito:groups'] as string];

  const isPrivileged = groups.includes('admin') || groups.includes('super_admin') || groups.includes('teachers');

  const exprNames: Record<string, string> = { '#pid': 'parentAssessId' };
  const exprValues: Record<string, any> = { ':pid': { S: parentAssessId } };

  const params: any = {
    TableName: studentAssessmentsTable,
    IndexName: 'ParentAssessIdIndex',
    KeyConditionExpression: '#pid = :pid',
    ExpressionAttributeNames: exprNames,
    ExpressionAttributeValues: exprValues,
  };

  if (!isPrivileged) {
    const uid = idt?.sub;
    if (!uid) return [];
    params.FilterExpression = '#uid = :uid';
    params.ExpressionAttributeNames['#uid'] = 'userId';
    params.ExpressionAttributeValues[':uid'] = { S: uid };
  }

  const items: any[] = [];
  let lastKey: any = undefined;
  do {
    const resp = await dynamo.send(new QueryCommand({ ...params, ExclusiveStartKey: lastKey }));
    (resp.Items || []).forEach((it) => {
      const item = unmarshall(it);
      // 应用默认值，防止GraphQL null错误
      const safeItem = fillStudentAssessmentDefaults(item);
      items.push(safeItem);
    });
    lastKey = resp.LastEvaluatedKey;
  } while (lastKey);

  return items;
};
