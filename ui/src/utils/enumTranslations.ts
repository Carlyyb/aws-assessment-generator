import { AssessType, Taxonomy } from '../graphql/API';
import { getText } from '../i18n/lang';

/**
 * 获取 AssessType 枚举值的本地化显示文本
 */
export const getAssessTypeText = (assessType: AssessType): string => {
  switch (assessType) {
    case AssessType.multiChoiceAssessment:
      return getText('assessType.multiChoiceAssessment');
    case AssessType.freeTextAssessment:
      return getText('assessType.freeTextAssessment');
    default:
      return assessType;
  }
};

/**
 * 获取 Taxonomy 枚举值的本地化显示文本
 */
export const getTaxonomyText = (taxonomy: Taxonomy): string => {
  switch (taxonomy) {
    case Taxonomy.Knowledge:
      return getText('taxonomy.Knowledge');
    case Taxonomy.Comprehension:
      return getText('taxonomy.Comprehension');
    case Taxonomy.Application:
      return getText('taxonomy.Application');
    case Taxonomy.Analysis:
      return getText('taxonomy.Analysis');
    case Taxonomy.Synthesis:
      return getText('taxonomy.Synthesis');
    case Taxonomy.Evaluation:
      return getText('taxonomy.Evaluation');
    default:
      return taxonomy;
  }
};

/**
 * 获取所有 AssessType 选项（用于下拉菜单等）
 */
export const getAssessTypeOptions = () => [
  {
    label: getAssessTypeText(AssessType.multiChoiceAssessment),
    value: AssessType.multiChoiceAssessment,
  },
  {
    label: getAssessTypeText(AssessType.freeTextAssessment),
    value: AssessType.freeTextAssessment,
  },
];

/**
 * 获取所有 Taxonomy 选项（用于下拉菜单等）
 */
export const getTaxonomyOptions = () => [
  {
    label: getTaxonomyText(Taxonomy.Knowledge),
    value: Taxonomy.Knowledge,
  },
  {
    label: getTaxonomyText(Taxonomy.Comprehension),
    value: Taxonomy.Comprehension,
  },
  {
    label: getTaxonomyText(Taxonomy.Application),
    value: Taxonomy.Application,
  },
  {
    label: getTaxonomyText(Taxonomy.Analysis),
    value: Taxonomy.Analysis,
  },
  {
    label: getTaxonomyText(Taxonomy.Synthesis),
    value: Taxonomy.Synthesis,
  },
  {
    label: getTaxonomyText(Taxonomy.Evaluation),
    value: Taxonomy.Evaluation,
  },
];
