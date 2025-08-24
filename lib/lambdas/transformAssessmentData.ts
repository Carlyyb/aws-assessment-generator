import { AppSyncResolverEvent, Context } from 'aws-lambda';
import { fillAssessmentDefaults, fillStudentAssessmentDefaults, fillRequiredFields } from '../utils/nullSafeQuery';

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
  event: any,
  context: Context
): Promise<any> => {
  console.log('Transform data event:', JSON.stringify(event, null, 2));
  
  try {
    // AppSync Lambda数据源的事件结构
    // 从 resolver 传递过来的参数在 event 中直接可用
    const operation = event.operation || 'transformAssessmentData';
    const data = event.data;
    const identity = event.identity;
    
    console.log('Extracted params:', { operation, hasData: !!data, identity });
    
    if (!data) {
      console.log('No data provided, returning null');
      return null;
    }
    
    switch (operation) {
      case 'transformAssessmentData':
        // 单个测试数据转换，应用默认值以防止null错误
        const transformedAssessment = transform(data);
        return fillAssessmentDefaults(transformedAssessment);
        
      case 'transformStudentAssessmentData':
        // 学生测试数据转换，特别处理 assessment 属性
        const transformedResult = transform(data);
        if (transformedResult && transformedResult.assessment) {
          transformedResult.assessment = fillAssessmentDefaults(transform(transformedResult.assessment));
        }
        return fillStudentAssessmentDefaults(transformedResult);
        
      case 'transformAssessmentListData':
        // 测试列表数据转换，为每个item应用默认值
        if (!data.items) return data;
        const transformedItems = data.items.map((item: any) => 
          fillAssessmentDefaults(transform(item))
        );
        return { items: transformedItems };
        
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  } catch (error) {
    console.error('Error in transform data handler:', error);
    throw error;
  }
};
