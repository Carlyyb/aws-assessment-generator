# 时区统一更新说明

## 更新概述

将整个系统的时间处理统一为UTC+8（北京时间）。

## 更新范围

### 1. 后端时间工具 (`lib/utils/timeUtils.ts`)
创建了统一的时间处理工具函数：
- `getCurrentBeijingTime()` - 获取当前北京时间的ISO字符串
- `formatBeijingTime()` - 格式化时间为北京时间显示
- `createTimestamp()` - 创建时间戳（用于数据库存储）
- 其他时区转换和处理函数

### 2. 前端时间工具 (`ui/src/utils/timeUtils.ts`)
创建了前端专用的时间处理工具函数，功能与后端一致，额外包含：
- `formatRelativeTime()` - 相对时间显示（今天、昨天、N天前）
- `toLocaleDateString()` - 本地化日期字符串

### 3. 后端代码更新

#### 解析器 (Resolvers)
- `getCurrentUser.ts` - 用户登录时间记录使用北京时间
- `changePassword.ts` - 密码修改时间戳使用北京时间
- `confirmPasswordReset.ts` - 密码重置相关时间戳使用北京时间

#### Lambda 函数
- `postAuthentication.ts` - 用户认证后的时间戳使用北京时间
- `userManagement.ts` - 用户管理相关的所有时间戳使用北京时间
- `publishAssessment.ts` - 评估发布时间使用北京时间

### 4. 前端代码更新

#### 页面组件
- `FindAssessments.tsx` - 评估时间显示使用北京时间格式
- `StudentAssessments.tsx` - 学生评估截止时间显示使用北京时间
- `StudentList.tsx` - 学生最后登录时间显示和分组创建时间使用北京时间
- `UserManagement.tsx` - 用户最后登录时间显示使用北京时间
- `GenerateAssessments.tsx` - 日志时间戳使用北京时间

#### 组件
- `KnowledgeBaseManager.tsx` - 知识库操作日志时间戳使用北京时间
- `PasswordChangeMonitor.tsx` - 优化了加载提示文本

### 5. 数据迁移脚本更新
- `migrate-assessment-datetime.js` - 更新为使用北京时间进行数据迁移

## 技术实现细节

### 时区处理原则
1. **数据库存储**：使用UTC时间存储（ISO字符串格式）
2. **前端显示**：统一转换为北京时间显示
3. **用户操作**：基于北京时间进行时间选择和输入

### 时间格式统一
- **存储格式**：ISO 8601 UTC 格式 (`YYYY-MM-DDTHH:mm:ss.sssZ`)
- **显示格式**：北京时间本地化格式 (`YYYY-MM-DD HH:mm`)
- **时区标识**：Asia/Shanghai

### 向后兼容性
- 现有数据通过迁移脚本自动转换
- 新的时间工具函数与现有代码兼容
- 不影响现有的时间比较和计算逻辑

## 部署注意事项

1. **运行数据迁移**：部署前需要运行 `migrate-assessment-datetime.js` 脚本
2. **环境变量**：确保 AWS_REGION 环境变量正确设置
3. **时区设置**：建议服务器时区设置为UTC，应用层统一处理时区转换

## 用户体验改进

1. **一致性**：所有时间显示统一为北京时间
2. **直观性**：相对时间显示（今天、昨天、N天前）
3. **精确性**：支持精确到分钟的时间选择和显示
4. **本地化**：符合中文用户的时间显示习惯

## 测试建议

1. 验证时间显示是否正确转换为北京时间
2. 测试跨时区用户的时间显示一致性
3. 确认时间相关功能（如计时器、截止时间）正常工作
4. 验证数据迁移的正确性

## 注意事项

- 客户端的实时计时功能（如评估计时器）仍使用本地时间，保证准确性
- 仅涉及显示和存储的时间统一为北京时间
- 保持了现有的时间比较和计算逻辑的准确性
