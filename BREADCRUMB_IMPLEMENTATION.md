# 动态面包屑导航实现说明

## ✅ 实现功能

成功为您的应用实现了动态面包屑导航，可以根据当前路由自动显示对应的层级路径。

## 📁 新增文件

### 1. 面包屑工具函数
- `ui/src/utils/breadcrumbs.ts` - 核心面包屑生成逻辑

## 🔧 修改的文件

### 1. 主应用文件
- `ui/src/App.tsx` - 集成动态面包屑功能

### 2. 翻译文件
- `ui/src/i18n/en.json` - 添加页面标题翻译
- `ui/src/i18n/zh.json` - 添加页面标题翻译

## 🌟 功能特性

### 1. 自动路径解析
根据当前 URL 路径自动生成面包屑层级：

- **首页**: `Home`
- **设置页**: `Home > User Settings`
- **管理页**: `Home > Management > Templates`
- **评估页**: `Home > Assessments > Find Assessments`
- **编辑页**: `Home > Edit Assessment > Current Assessment`

### 2. 多语言支持
所有面包屑文本都支持中英文切换：

```typescript
// 英文
Home > Management > Templates > Template Settings

// 中文  
首页 > 管理 > 模板 > 模板设置
```

### 3. 智能路径识别
- **普通路径**: 使用翻译文件中的导航文本
- **动态参数**: 智能识别 ID 参数并显示友好名称
- **特殊页面**: 为编辑、查看等页面提供专门的标题

### 4. 路径类型支持

#### 教师路由
- `/` → `Home`
- `/settings` → `Home > User Settings`
- `/management` → `Home > Management`
- `/management/templates` → `Home > Management > Templates`
- `/management/template-settings` → `Home > Management > Template Settings`
- `/assessments` → `Home > Assessments`
- `/assessments/find-assessments` → `Home > Assessments > Find Assessments`
- `/edit-assessment/123` → `Home > Edit Assessment > Current Assessment`

#### 学生路由
- `/` → `Home`
- `/settings` → `Home > User Settings`
- `/dashboard` → `Home > Dashboard`
- `/assessments` → `Home > Assessments`
- `/assessment/123` → `Home > Assessment > Current Assessment`
- `/review/123` → `Home > Review Assessment > Assessment Review`

## 💡 实现原理

### 1. 路径解析
```typescript
export function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [
    { text: getText('common.breadcrumb.home'), href: '/' }
  ];

  const pathSegments = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  // ... 路径处理逻辑
}
```

### 2. 智能文本获取
```typescript
function getNavigationText(segment: string): string {
  // 特殊页面处理
  switch (segment) {
    case 'edit-assessment':
      return getText('teachers.assessments.edit.title');
    // ...
  }
  
  // 从导航翻译获取
  const navKey = `common.nav.${segment}`;
  const navText = getText(navKey);
  
  // 回退到格式化的段名
  return segment.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}
```

### 3. 动态参数处理
```typescript
function getSegmentDisplayName(segment: string, pathSegments: string[], index: number): string {
  const previousSegment = pathSegments[index - 1];
  
  switch (previousSegment) {
    case 'assessment':
      return getText('students.assessment.current');
    case 'edit-assessment':
      return getText('teachers.assessments.edit.current');
    // ...
  }
}
```

## 🔧 使用方式

### 在 App.tsx 中的使用
```tsx
import { generateBreadcrumbs } from './utils/breadcrumbs';

// 在 AppLayout 中使用
<AppLayout
  breadcrumbs={
    <BreadcrumbGroup
      items={generateBreadcrumbs(activeHref)}
    />
  }
  // ...
/>
```

### 自定义面包屑
如果需要为新的页面添加自定义面包屑：

1. **添加翻译键**:
```json
// en.json
"common": {
  "nav": {
    "new-page": "New Page"
  }
}

// zh.json  
"common": {
  "nav": {
    "new-page": "新页面"
  }
}
```

2. **特殊处理** (如果需要):
```typescript
// 在 getNavigationText 函数中添加
case 'new-page':
  return getText('custom.new_page.title');
```

## 🎯 设计优势

1. **自动化**: 无需手动配置每个页面的面包屑
2. **多语言**: 完整支持中英文切换
3. **灵活性**: 易于扩展新的路由和页面
4. **一致性**: 所有页面使用统一的面包屑样式
5. **智能化**: 自动识别路径类型并提供合适的显示名称

## 🚀 测试结果

✅ TypeScript 编译通过  
✅ Vite 构建成功  
✅ 支持所有现有路由  
✅ 多语言切换正常  
✅ 动态参数识别正确  

现在您的应用将根据当前页面自动显示正确的面包屑导航路径！
