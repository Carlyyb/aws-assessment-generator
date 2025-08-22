# DynamoDB 表管理工具说明

## 文件说明

### 1. PROJECT_FEATURES_DOCUMENTATION.md
包含完整的DynamoDB表结构信息，位于 "## DynamoDB 表结构信息" 章节，提供：
- 所有11个表的详细信息
- 表的主键架构
- 大小和用途说明
- 数据访问模式分析

### 2. dynamodb-tables-info.js
JavaScript工具脚本，提供：
- 所有表信息的结构化数据
- 快速查询函数
- Key生成工具
- 使用示例

### 3. migrate-assessment-datetime.js
数据迁移脚本，用于：
- 将Assessment表的AWSDate字段转换为AWSDateTime
- 支持安全的数据格式升级
- 包含错误处理和日志记录

## 快速使用

### 查看所有表信息
```bash
node dynamodb-tables-info.js
```

### 在代码中使用表信息
```javascript
const { DYNAMODB_TABLES, generateKey, getTableByLogicalName } = require('./dynamodb-tables-info.js');

// 获取Assessment表完整名称
const assessTableName = DYNAMODB_TABLES.ASSESSMENTS.fullName;

// 生成DynamoDB查询Key
const key = generateKey('ASSESSMENTS', 'userId123', 'assessmentId456');

// 查找特定表
const userTable = getTableByLogicalName('UsersTable');
```

### 运行数据迁移
```bash
# 确保AWS凭证配置正确
node migrate-assessment-datetime.js
```

## 表架构快速参考

| 表名 | 主键 | 用途 | 大小 |
|------|------|------|------|
| AssessmentsTable | userId + id | 评估数据 | 40.8KB |
| StudentAssessmentsTable | userId + parentAssessId | 学生评估记录 | 1.9KB |
| UsersTable | id | 用户信息 | 6.7KB |
| CoursesTable | id | 课程信息 | 541B |
| AssessTemplatesTable | userId + id | 评估模板 | 510B |
| StudentGroupsTable | id | 学生分组 | 142B |
| StudentsTable | id | 学生信息 | 0B |
| SettingsTable | userId | 系统设置 | 102.9KB |
| KBTable | userId + courseId | 知识库 | 2KB |
| LogAnalyticsTable | logId + timestamp | 日志分析 | 0B |
| SystemMetricsTable | metricKey + timestamp | 系统指标 | 0B |

## 开发注意事项

1. **复合主键**: 大部分表使用 `userId + 其他键` 的模式
2. **权限配置**: 确保Lambda函数有相应表的读写权限
3. **表名变化**: CDK重新部署可能会改变表名，需要更新配置
4. **数据迁移**: 修改表结构前一定要做好数据备份

## 更新说明

当AWS环境或表结构发生变化时，需要更新：
1. `dynamodb-tables-info.js` 中的表名和结构信息
2. `PROJECT_FEATURES_DOCUMENTATION.md` 中的表信息
3. 相关的迁移脚本和Lambda函数
