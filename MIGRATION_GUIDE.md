# 数据迁移指南 - 清除模板数据

## 概述

这个迁移脚本用于清除旧的 `assessTemplatesTable` 数据，为新的表结构做准备。

## ⚠️ 重要警告

- **此操作不可逆**：数据删除后无法恢复
- **请先备份重要数据**
- **建议在测试环境先试运行**

## 使用步骤

### 1. 准备工作

确保您有以下权限和配置：

```bash
# 1. AWS CLI 已配置
aws configure list

# 2. 确认当前区域
aws configure get region

# 3. 确认有 DynamoDB 访问权限
aws dynamodb list-tables
```

### 2. 获取表名

有几种方法获取实际的表名：

#### 方法一：通过 CloudFormation 控制台
1. 打开 AWS CloudFormation 控制台
2. 找到 `GenAssessStack` 堆栈
3. 查看 "资源" 标签页
4. 找到 `AssessTemplatesTable` 资源的物理 ID

#### 方法二：通过 AWS CLI
```bash
# 列出所有表，查找包含 AssessTemplate 的表名
aws dynamodb list-tables --query "TableNames[?contains(@, 'AssessTemplate')]"
```

#### 方法三：通过堆栈输出
```bash
# 查看堆栈输出
aws cloudformation describe-stacks --stack-name GenAssessStack --query "Stacks[0].Outputs"
```

### 3. 设置表名

选择以下方式之一设置表名：

#### 方式一：环境变量
```bash
export ASSESS_TEMPLATE_TABLE="实际的表名"
```

#### 方式二：直接修改脚本
编辑 `migration-clear-templates.js` 文件：
```javascript
const tableName = process.env.ASSESS_TEMPLATE_TABLE || '你的实际表名';
```

### 4. 安装依赖

```bash
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

### 5. 运行脚本

#### 第一次运行（查看数据）
```bash
node migration-clear-templates.js
```

这会显示表中的数据但不会删除（安全模式）。

#### 确认删除并执行
1. 编辑脚本文件
2. 将 `CONFIRM_DELETE` 改为 `true`：
   ```javascript
   const CONFIRM_DELETE = true; // 修改为 true 以确认删除
   ```
3. 再次运行：
   ```bash
   node migration-clear-templates.js
   ```

## 脚本功能

### 1. 表结构验证
- 检查表是否存在
- 显示示例数据结构
- 验证权限

### 2. 数据扫描
- 扫描所有现有模板
- 显示数据统计
- 列出将要删除的项目

### 3. 安全删除
- 批量删除操作
- 错误处理和重试
- 进度显示
- 最终统计报告

## 输出示例

```
🔧 模板数据迁移脚本 - 清除模式
================================

📋 目标表: GenAssessStack-DataStack-AssessTemplatesTable-ABC123

🔍 验证表结构...
📋 示例数据结构:
{
  "id": "01HXXX...",
  "userId": "user123",
  "name": "测试模板",
  "assessType": "multiChoiceAssessment",
  "createdAt": "2025-01-01T00:00:00Z"
}

🚀 开始清除所有模板数据...

🔍 扫描表 GenAssessStack-DataStack-AssessTemplatesTable-ABC123 中的所有模板...
📋 已扫描 5 个模板，总计 5 个

📊 找到 5 个模板需要删除:
   1. 数学测试模板 (01HXXX...)
   2. 英语测试模板 (01HYYY...)
   3. 物理测试模板 (01HZZZ...)
   4. 化学测试模板 (01HAAA...)
   5. 历史测试模板 (01HBBB...)

⚠️  警告：此操作将永久删除所有模板数据！
如果要继续，请修改脚本中的 CONFIRM_DELETE 变量为 true

❌ 操作已取消。如需执行删除，请设置 CONFIRM_DELETE = true
```

## 故障排除

### 常见错误

1. **表不存在**
   ```
   ❌ 表结构验证失败: ResourceNotFoundException
   ```
   - 检查表名是否正确
   - 确认区域设置
   - 验证 AWS 凭证

2. **权限不足**
   ```
   ❌ 扫描失败: AccessDeniedException
   ```
   - 确认 IAM 权限包含 `dynamodb:Scan` 和 `dynamodb:DeleteItem`
   - 检查资源级权限

3. **网络超时**
   ```
   ❌ 删除模板失败: TimeoutError
   ```
   - 检查网络连接
   - 增加脚本中的延迟时间

### 恢复选项

如果意外删除了数据：

1. **从备份恢复**（推荐）
   - 使用 DynamoDB 的时间点恢复
   - 从应用程序备份恢复

2. **手动重建**
   - 使用新的表结构重新创建模板

## 清理

脚本执行完成后：

1. 删除迁移脚本（可选）
2. 验证新的表结构工作正常
3. 部署更新后的应用程序

## 支持

如果遇到问题：

1. 检查 AWS CloudTrail 日志
2. 查看 DynamoDB 监控指标
3. 参考 AWS 文档

---

**重要提醒**：执行前请确保已备份重要数据！
