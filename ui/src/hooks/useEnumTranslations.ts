import { useMemo } from 'react';
import { 
  getAssessTypeText, 
  getTaxonomyText, 
  getAssessTypeOptions, 
  getTaxonomyOptions 
} from '../utils/enumTranslations';

/**
 * Hook: 提供多语言化的枚举值工具函数
 * 使用 useMemo 优化性能，避免不必要的重新计算
 */
export const useEnumTranslations = () => {
  // 缓存选项列表，避免每次渲染都重新创建
  const assessTypeOptions = useMemo(() => getAssessTypeOptions(), []);
  const taxonomyOptions = useMemo(() => getTaxonomyOptions(), []);

  return {
    // 文本转换函数
    getAssessTypeText,
    getTaxonomyText,
    
    // 选项列表（用于下拉菜单等）
    assessTypeOptions,
    taxonomyOptions,
    
    // 原始选项获取函数（如果需要动态生成）
    getAssessTypeOptions,
    getTaxonomyOptions,
  };
};

/**
 * Hook: 专门用于 AssessType 的多语言化
 */
export const useAssessTypeTranslation = () => {
  const assessTypeOptions = useMemo(() => getAssessTypeOptions(), []);
  
  return {
    getAssessTypeText,
    assessTypeOptions,
    getAssessTypeOptions,
  };
};

/**
 * Hook: 专门用于 Taxonomy 的多语言化
 */
export const useTaxonomyTranslation = () => {
  const taxonomyOptions = useMemo(() => getTaxonomyOptions(), []);
  
  return {
    getTaxonomyText,
    taxonomyOptions,
    getTaxonomyOptions,
  };
};
