# 模板管理功能增强 - 删除功能实现

## 功能概述

为Templates.tsx页面添加了以下功能：
1. **单个删除功能** - 每行末尾的删除按钮
2. **多选功能** - 表格支持多选模板
3. **批量删除功能** - 选中多个模板后批量删除
4. **权限控制** - 管理员可删除任何模板，普通用户只能删除自己创建的模板
5. **用户友好的确认对话框** - 删除前确认操作

## 实现的文件修改

### 1. 后端 GraphQL Schema (`lib/schema.graphql`)
- 添加了 `deleteAssessTemplate(id: ID!): Boolean` mutation

### 2. 后端 Resolver (`lib/resolvers/deleteAssessTemplate.ts`)
- 实现了删除模板的逻辑
- 管理员可以删除任何模板
- 普通用户只能删除自己创建的模板（通过条件删除实现）

### 3. 前端 GraphQL Mutations (`ui/src/graphql/mutations.ts`)
- 添加了 `deleteAssessTemplate` mutation

### 4. 语言文件
- **中文** (`ui/src/i18n/zh.json`):
  - `delete_template`: "删除模板"
  - `delete_selected`: "删除选中项"
  - `delete_confirm`: "确认删除"
  - `delete_confirm_single`: "确定要删除这个模板吗？"
  - `delete_confirm_multiple`: "确定要删除选中的 {count} 个模板吗？"
  - `delete_success`: "模板删除成功"
  - `delete_error`: "删除模板失败"
  - `delete_partial_success`: "部分模板删除成功：{deletedCount} 个成功，{failedCount} 个失败"
  - `no_templates_selected`: "请选择要删除的模板"
  - `actions`: "操作"

- **英文** (`ui/src/i18n/en.json`): 对应的英文翻译

### 5. 主要组件 (`ui/src/pages/Templates.tsx`)

#### 新增状态管理
```typescript
const [selectedItems, setSelectedItems] = useState<AssessTemplate[]>([]);
const [showDeleteModal, setShowDeleteModal] = useState(false);
const [isDeleting, setIsDeleting] = useState(false);
const [deleteTarget, setDeleteTarget] = useState<'single' | 'multiple'>('single');
const [templateToDelete, setTemplateToDelete] = useState<AssessTemplate | null>(null);
```

#### 新增功能函数
- `loadTemplates()` - 重构的模板加载函数
- `handleDeleteSingle(template)` - 处理单个删除
- `handleDeleteMultiple()` - 处理批量删除
- `confirmDelete()` - 确认删除操作

#### UI 增强
1. **表格多选支持**:
   ```typescript
   <Table
     selectionType="multi"
     selectedItems={selectedItems}
     onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
   ```

2. **表头操作按钮**:
   - "删除选中项" 按钮 (当有选中项时启用)
   - "创建新模板" 按钮

3. **新增操作列**:
   - 每行末尾的删除图标按钮
   - 使用 `variant="icon"` 的简洁样式

4. **确认删除模态框**:
   - 根据删除类型显示不同的确认信息
   - 有取消和确认按钮
   - 删除时显示加载状态

## 权限控制逻辑

### 后端权限验证
- **管理员用户**: 可以删除任何模板
- **普通用户**: 只能删除自己创建的模板
- 使用DynamoDB的条件删除确保权限控制

### 前端用户体验
- 所有用户都可以看到删除按钮
- 权限验证在后端进行，前端会显示相应的错误信息
- 批量删除使用 `Promise.allSettled` 处理部分成功的情况

## 错误处理

1. **网络错误**: 显示通用删除失败信息
2. **权限错误**: 后端返回权限不足错误
3. **部分成功**: 批量删除时部分成功的情况
4. **用户友好提示**: 所有操作都有相应的成功/失败提示

## 技术特点

- **类型安全**: 使用 TypeScript 类型定义
- **国际化支持**: 支持中英文切换
- **响应式设计**: 使用 CloudScape Design 组件
- **权限分离**: 前端UI + 后端权限验证
- **批量操作优化**: 前端并发删除，提高性能

## 使用方式

1. **删除单个模板**: 点击表格行末尾的删除图标
2. **批量删除模板**: 
   - 选中要删除的模板（复选框）
   - 点击表头的"删除选中项"按钮
   - 在确认对话框中确认操作

## 注意事项

- 删除操作不可撤销
- 普通用户只能删除自己创建的模板
- 管理员可以删除所有模板
- 删除前会显示确认对话框
- 删除后会自动刷新模板列表
