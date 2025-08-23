# 删除课程时自动删除知识库功能实现

## 功能概述

现在当删除课程时，系统会自动删除该课程关联的Bedrock知识库，包括：
- 删除Bedrock知识库本身
- 删除关联的数据源
- 清理S3存储桶中的相关文件
- 从DynamoDB中删除知识库记录

## 技术实现

### 1. 新增的Lambda函数

**文件：** `lib/lambdas/deleteKnowledgeBase.ts`
- 负责删除Bedrock知识库和相关资源
- 包含错误处理和清理逻辑

### 2. GraphQL Resolvers

**删除知识库Resolver：** `lib/resolvers/deleteKnowledgeBase.ts`
- 直接调用删除知识库Lambda函数

**课程删除清理Resolver：** `lib/resolvers/cleanupKnowledgeBase.ts`
- 在删除课程后自动调用，清理关联的知识库

**课程删除Resolver：** `lib/resolvers/deleteCourse.ts`
- 更新为标准的删除课程逻辑

### 3. Pipeline Resolver

删除课程现在使用Pipeline Resolver，执行顺序：
1. 删除课程记录（deleteCourse）
2. 清理关联知识库（cleanupKnowledgeBase）

### 4. GraphQL Schema更新

新增类型定义：
```graphql
type KnowledgeBaseDeletionResult {
  success: Boolean!
  message: String!
  details: KnowledgeBaseDeletionDetails
}

type KnowledgeBaseDeletionDetails {
  knowledgeBaseId: String
  dataSourceId: String
  s3prefix: String
  courseId: String
}
```

新增Mutation：
```graphql
deleteKnowledgeBase(courseId: ID!): KnowledgeBaseDeletionResult
```

### 5. 前端集成

**新增mutation：** `ui/src/graphql/mutations.ts`
```typescript
export const deleteKnowledgeBase = /* GraphQL */ `
  mutation DeleteKnowledgeBase($courseId: ID!) {
    deleteKnowledgeBase(courseId: $courseId) {
      success
      message
      details {
        knowledgeBaseId
        dataSourceId
        s3prefix
        courseId
      }
    }
  }
`;
```

### 6. 权限配置

为删除知识库Lambda函数配置了以下权限：
- `bedrock:DeleteKnowledgeBase`
- `bedrock:DeleteDataSource`
- `bedrock:GetKnowledgeBase`
- `bedrock:ListDataSources`
- S3删除和列表权限
- DynamoDB读写权限

## 使用方式

### 手动删除知识库
```typescript
const result = await client.graphql({
  query: deleteKnowledgeBase,
  variables: { courseId: 'course-id-here' }
});
```

### 自动删除（删除课程时）
```typescript
const result = await client.graphql({
  query: deleteCourse,
  variables: { id: 'course-id-here' }
});
// 知识库会自动删除
```

## 安全特性

1. **权限控制：** 只有认证用户才能删除知识库
2. **错误处理：** 完整的错误处理和回滚机制
3. **日志记录：** 详细的操作日志，便于调试和审计

## 测试

使用 `test-delete-knowledge-base.js` 脚本测试功能：
```bash
node test-delete-knowledge-base.js
```

## 部署状态

✅ 已成功部署到AWS
✅ 所有相关资源已创建
✅ Pipeline Resolver配置完成
✅ S3 CORS配置已修复（支持DELETE操作）

## 注意事项

1. 删除知识库是不可逆操作
2. 删除课程会自动删除关联知识库
3. 确保在删除前做好数据备份
4. 删除操作会清理所有相关的AWS资源，包括S3文件
