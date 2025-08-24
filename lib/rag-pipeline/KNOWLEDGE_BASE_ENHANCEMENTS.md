# 知识库管理系统 - 增强功能文档

## 概述

本系统提供了完整的知识库文档管理功能，包括文档上传、版本控制、错误处理和重试机制。

## 新增功能

### 1. 错误修复 - S3 CopySource 编码问题

**问题描述**：
- 当文件名包含中文字符、特殊字符或空格时，S3 CopyObject 操作会失败
- 错误信息：`Invalid character in header content ["x-amz-copy-source"]`

**解决方案**：
- 对 S3 对象键进行 URL 编码处理
- 保留路径分隔符 `/` 不被编码
- 添加详细的错误日志记录

**代码位置**：
- `lib/rag-pipeline/lambdas/event-handler/index.ts` 中的 `copyObject` 方法

### 2. 文档版本控制系统

**功能特性**：
- 自动备份文档的历史版本
- 可配置保留版本数量（默认5个）
- 支持版本恢复操作
- 自动清理过期版本

**核心组件**：

#### DocumentVersionControl 类
位置：`lib/rag-pipeline/lambdas/event-handler/utils/versionControl.ts`

**主要方法**：
- `handleDocumentUpdate()`: 处理文档更新时的版本控制
- `getVersionHistory()`: 获取文档版本历史
- `restoreVersion()`: 恢复到指定版本
- `cleanupOldVersions()`: 清理旧版本

**配置选项**：
```typescript
interface VersionControlConfig {
  enableVersioning: boolean;     // 是否启用版本控制
  maxVersions: number;          // 最大保留版本数
  archivePrefix: string;        // 归档文件前缀
}
```

### 3. S3 事件驱动处理器

**功能说明**：
- 监听 S3 存储桶的 ObjectCreated 和 ObjectRemoved 事件
- 自动触发知识库同步或删除操作
- 集成版本控制功能

**核心组件**：
位置：`lib/rag-pipeline/lambdas/s3-event-handler/index.ts`

**支持的事件类型**：
- `ObjectCreated:*`: 文件上传/更新
- `ObjectRemoved:*`: 文件删除

### 4. 版本管理 API

**GraphQL Schema**：
位置：`lib/rag-pipeline/lambdas/version-management/schema.graphql`

**查询操作**：
```graphql
# 获取文档版本历史
query GetDocumentVersionHistory {
  getDocumentVersionHistory(
    courseId: "course123"
    documentKey: "documents/example.pdf"
  ) {
    documentKey
    courseId
    versions {
      versionKey
      lastModified
      size
      timestamp
    }
  }
}
```

**变更操作**：
```graphql
# 恢复文档版本
mutation RestoreDocumentVersion {
  restoreDocumentVersion(
    courseId: "course123"
    documentKey: "documents/example.pdf"
    versionKey: "archive/versions/course123/user456/2023-12-01T10-30-00/documents/example.pdf"
  ) {
    success
    message
    documentKey
    restoredFromVersion
  }
}
```

### 5. 重试机制

**功能特性**：
- 指数退避算法
- 可配置重试次数和延迟
- 智能错误类型判断
- 添加随机抖动减少雷群效应

**核心组件**：
位置：`lib/rag-pipeline/lambdas/event-handler/utils/retryHandler.ts`

**使用示例**：
```typescript
const result = await defaultRetryHandler.executeWithRetry(
  async () => {
    // 可能失败的操作
    return await someAsyncOperation();
  },
  'operationName',
  { contextData: 'value' }
);
```

## 环境变量配置

创建 `.env` 文件并配置以下变量：

```bash
# 版本控制
ENABLE_VERSION_CONTROL=true
MAX_VERSIONS=5
ARCHIVE_PREFIX=archive/versions/

# 重试配置
MAX_RETRY_ATTEMPTS=3
BASE_DELAY_MS=1000
MAX_DELAY_MS=30000

# AWS 服务配置
ARTIFACTS_UPLOAD_BUCKET=your-upload-bucket
KB_STAGING_BUCKET=your-kb-bucket
BEDROCK_ROLE_ARN=your-bedrock-role-arn
OPSS_COLLECTION_ARN=your-opensearch-collection-arn
KB_TABLE=your-dynamodb-table
```

## 部署说明

### 1. 部署新的 Lambda 函数

确保在 CDK 栈中添加以下 Lambda 函数：

- **Version Management Handler**: 处理版本管理 GraphQL 操作
- **S3 Event Handler**: 处理 S3 事件驱动的知识库同步

### 2. 更新 IAM 权限

确保 Lambda 执行角色具有以下权限：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:CopyObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket/*",
        "arn:aws:s3:::your-bucket"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:*"
      ],
      "Resource": "*"
    }
  ]
}
```

### 3. 配置 S3 事件通知

在 S3 存储桶中配置事件通知，将 ObjectCreated 和 ObjectRemoved 事件发送到 S3EventHandler Lambda 函数。

## 使用示例

### 前端集成

```typescript
// 获取文档版本历史
const getVersionHistory = async (courseId: string, documentKey: string) => {
  const query = `
    query GetVersionHistory($courseId: String!, $documentKey: String!) {
      getDocumentVersionHistory(courseId: $courseId, documentKey: $documentKey) {
        versions {
          versionKey
          lastModified
          size
        }
      }
    }
  `;
  
  const result = await API.graphql({
    query,
    variables: { courseId, documentKey }
  });
  
  return result.data.getDocumentVersionHistory;
};

// 恢复文档版本
const restoreVersion = async (courseId: string, documentKey: string, versionKey: string) => {
  const mutation = `
    mutation RestoreVersion($courseId: String!, $documentKey: String!, $versionKey: String!) {
      restoreDocumentVersion(courseId: $courseId, documentKey: $documentKey, versionKey: $versionKey) {
        success
        message
      }
    }
  `;
  
  const result = await API.graphql({
    query: mutation,
    variables: { courseId, documentKey, versionKey }
  });
  
  return result.data.restoreDocumentVersion;
};
```

## 监控和故障排除

### 日志监控

所有操作都会记录详细日志，可以在 CloudWatch Logs 中查看：

- Lambda 函数执行日志
- S3 事件处理日志
- 版本控制操作日志
- 错误和重试日志

### 常见问题

1. **文件名编码问题**
   - 确保文件名不包含特殊字符
   - 系统会自动处理 URL 编码

2. **版本控制存储空间**
   - 定期检查归档目录的存储使用量
   - 调整 `MAX_VERSIONS` 配置以控制版本数量

3. **知识库同步失败**
   - 检查 Bedrock 服务权限
   - 查看重试机制日志
   - 验证 S3 存储桶配置

## 性能优化建议

1. **批量处理**：对于大量文件操作，考虑实现批量处理机制
2. **异步处理**：使用 SQS 队列实现异步文档处理
3. **缓存策略**：缓存知识库元数据减少 DynamoDB 查询
4. **监控指标**：设置 CloudWatch 自定义指标监控系统性能

## 安全考虑

1. **访问控制**：确保只有授权用户可以访问版本管理功能
2. **数据加密**：启用 S3 和 DynamoDB 的加密功能
3. **审计日志**：记录所有版本控制操作的审计日志
4. **权限最小化**：Lambda 函数只授予必要的最小权限
