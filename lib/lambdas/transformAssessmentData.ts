import { AppSyncResolverEvent, Context } from 'aws-lambda';

export interface TransformDataPayload {
  operation: 'transformAssessmentData' | 'transformStudentAssessmentData' | 'transformAssessmentListData';
  data: any;
  identity: any;
}

// 简单的内联数据转换，处理 DynamoDB 格式
function transform(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  // 处理 DynamoDB 数据类型
  if (obj.S !== undefined) return obj.S;
  if (obj.N !== undefined) return parseInt(obj.N);
  if (obj.BOOL !== undefined) return obj.BOOL;
  if (obj.L !== undefined) return obj.L.map((item: any) => transform(item));
  if (obj.M !== undefined) {
    const transformed: any = {};
    for (const key in obj.M) {
      if (obj.M.hasOwnProperty(key)) {
        transformed[key] = transform(obj.M[key]);
      }
    }
    return transformed;
  }
  
  // 处理普通对象
  if (Array.isArray(obj)) {
    return obj.map((item: any) => transform(item));
  }
  
  const transformed: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      transformed[key] = transform(obj[key]);
    }
  }
  return transformed;
}

export const handler = async (
  event: TransformDataPayload,
  context: Context
): Promise<any> => {
  console.log('Transform data event:', JSON.stringify(event, null, 2));
  
  try {
    const { operation, data } = event;
    
    if (!data) {
      return null;
    }
    
    switch (operation) {
      case 'transformAssessmentData':
        // 单个评估数据转换
        return transform(data);
        
      case 'transformStudentAssessmentData':
        // 学生评估数据转换，特别处理 assessment 属性
        const transformedResult = transform(data);
        if (transformedResult && transformedResult.assessment) {
          transformedResult.assessment = transform(transformedResult.assessment);
        }
        return transformedResult;
        
      case 'transformAssessmentListData':
        // 评估列表数据转换
        if (!data.items) return data;
        const transformedItems = data.items.map((item: any) => transform(item));
        return { items: transformedItems };
        
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  } catch (error) {
    console.error('Error in transform data handler:', error);
    throw error;
  }
};
