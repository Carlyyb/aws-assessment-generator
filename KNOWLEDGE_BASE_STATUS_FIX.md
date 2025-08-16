# 知识库状态字段缺失问题修复

## 问题描述

系统在查询知识库时出现GraphQL错误：
```
Cannot return null for non-nullable type: 'String' within parent 'KnowledgeBase' (/getKnowledgeBase/status)
```

这个错误是因为：
1. GraphQL schema中定义`KnowledgeBase.status`为非空字段 (`String!`)
2. 但是DynamoDB中某些知识库记录缺少`status`字段
3. 当查询这些记录时，会返回null值，违反了非空约束

## 根本原因

在`BedrockKnowledgeBase.getKnowledgeBase()`方法中，创建新知识库时只存储了以下字段：
- userId
- courseId  
- knowledgeBaseId
- kbDataSourceId
- indexName
- s3prefix

但是没有存储`status`字段，而GraphQL schema要求这个字段必须存在。

## 解决方案

### 1. 修复Resolver处理逻辑

更新了`getKnowledgeBase.ts` resolver，在response函数中添加了默认值处理：

```typescript
export const response = (ctx) => {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  
  // 如果没有找到记录，返回null
  if (!ctx.result) {
    return null;
  }
  
  // 确保status字段存在，如果不存在则提供默认值
  if (!ctx.result.status) {
    ctx.result.status = 'ACTIVE';
  }
  
  return ctx.result;
};
```

### 2. 修复数据存储逻辑

更新了`BedrockKnowledgeBase`类，在创建知识库时包含`status`字段：

```typescript
const storeKBResponse = await docClient.send(
  new PutCommand({
    TableName: KB_TABLE,
    Item: {
      userId,
      courseId,
      knowledgeBaseId,
      kbDataSourceId,
      indexName: vectorStore.indexName,
      s3prefix,
      status: 'ACTIVE',  // 新增状态字段
    },
  })
);
```

### 3. 增强前端错误处理

更新了多个前端组件，添加了更好的GraphQL错误处理：

- `CourseDashboard.tsx`
- `GenerateAssessments.tsx`
- `KnowledgeBaseManager.tsx`

### 4. 数据迁移脚本

创建了`update-knowledge-base-status.js`脚本来更新现有的知识库记录，为缺少status字段的记录添加默认值。

## 部署步骤

1. **部署代码更新**：
   ```bash
   npm run deploy
   ```

2. **运行数据迁移脚本**（可选，如果有现有的知识库记录）：
   ```bash
   # 设置正确的表名和AWS配置
   export KB_TABLE="your-actual-kb-table-name"
   export AWS_REGION="your-aws-region"
   node update-knowledge-base-status.js
   ```

## 验证

修复后，应该能够：
1. 成功查询现有的知识库，不再出现GraphQL错误
2. 新创建的知识库会正确包含status字段
3. 前端界面能正确显示知识库状态

## 注意事项

- 所有新创建的知识库现在都会有默认状态'ACTIVE'
- 现有的知识库记录需要通过迁移脚本更新
- 如果未来需要其他状态值，可以在适当的时候更新status字段
