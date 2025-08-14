# 枚举值多语言化实现说明

## ✅ 完成的工作

已成功为您的项目实现了 `AssessType` 和 `Taxonomy` 枚举值的多语言化功能，无需修改任何自动生成的文件或 GraphQL Schema。

## 📁 新增文件

### 1. 核心工具函数
- `ui/src/utils/enumTranslations.ts` - 枚举值翻译的核心工具函数

### 2. React Hook 封装
- `ui/src/hooks/useEnumTranslations.ts` - 用于组件中使用的 React Hook

## 🔧 修改的现有文件

### 1. 翻译文件
- `ui/src/i18n/en.json` - 添加了枚举值的英文翻译
- `ui/src/i18n/zh.json` - 添加了枚举值的中文翻译

### 2. 组件和页面
- `ui/src/components/CreateTemplate.tsx` - 模板创建表单的下拉菜单
- `ui/src/pages/DefaultSettings.tsx` - 默认设置页面的下拉菜单
- `ui/src/pages/UserSettings.tsx` - 用户设置页面的下拉菜单
- `ui/src/pages/TemplateSettings.tsx` - 模板设置页面的下拉菜单
- `ui/src/pages/Templates.tsx` - 模板列表表格中的显示

## 🌐 支持的翻译

### AssessType 枚举值
```typescript
AssessType.multiChoiceAssessment → "Multiple Choice Assessment" / "选择题评估"
AssessType.freeTextAssessment → "Free Text Assessment" / "问答题评估"
```

### Taxonomy 枚举值
```typescript
Taxonomy.Knowledge → "Knowledge" / "知识"
Taxonomy.Comprehension → "Comprehension" / "理解"
Taxonomy.Application → "Application" / "应用"
Taxonomy.Analysis → "Analysis" / "分析"
Taxonomy.Synthesis → "Synthesis" / "综合"
Taxonomy.Evaluation → "Evaluation" / "评估"
```

## 💡 使用方式

### 方式1: 直接使用工具函数
```typescript
import { getAssessTypeText, getTaxonomyText } from '../utils/enumTranslations';

// 在组件中显示多语言文本
<span>{getAssessTypeText(AssessType.multiChoiceAssessment)}</span>
<span>{getTaxonomyText(Taxonomy.Knowledge)}</span>
```

### 方式2: 使用 React Hook（推荐）
```typescript
import { useEnumTranslations } from '../hooks/useEnumTranslations';

const MyComponent = () => {
  const { getAssessTypeText, assessTypeOptions } = useEnumTranslations();
  
  return (
    <Select 
      options={assessTypeOptions}
      selectedOption={/* ... */}
      onChange={/* ... */}
    />
  );
};
```

### 方式3: 在表格中使用
```typescript
const columnDefinitions = [
  {
    id: 'assessType',
    header: getText('common.assessment_type'),
    cell: (item) => getAssessTypeText(item.assessType),
  }
];
```

## ⚡ 性能优化

- 使用 `useMemo` 缓存选项列表，避免不必要的重新计算
- 翻译函数使用 switch-case 优化性能
- 支持按需导入，不会影响打包体积

## 🎯 设计原则

1. **零破坏性**: 不修改任何自动生成的文件
2. **类型安全**: 完全支持 TypeScript 类型检查
3. **向后兼容**: 现有代码无需修改即可继续工作
4. **易于维护**: 集中管理所有枚举值翻译
5. **灵活扩展**: 可以轻松添加新的枚举值翻译

## 🚀 测试结果

✅ TypeScript 编译通过  
✅ Vite 构建成功  
✅ 所有现有功能正常工作  
✅ 新的多语言化功能已集成  

## 📝 注意事项

1. 当添加新的枚举值时，记得在翻译文件中添加对应的翻译
2. 逻辑判断仍然使用原始枚举值（如 `assessment.assessType === AssessType.multiChoiceAssessment`）
3. 只有在向用户**显示**枚举值时才使用翻译函数
4. 翻译键名直接使用枚举值本身，保持一致性
