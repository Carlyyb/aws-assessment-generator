# AWS Assessment Generator IAM权限架构分析

## 项目IAM权限附加方式

### 1. 权限附加的三种主要方式

#### 方式一：直接使用Lambda Role添加策略
```typescript
// 在 data-stack.ts 中
changePasswordFunction.addToRolePolicy(new aws_iam.PolicyStatement({
  effect: aws_iam.Effect.ALLOW,
  actions: ['cognito-idp:AdminSetUserPassword', 'cognito-idp:AdminInitiateAuth'],
  resources: [userPool.userPoolArn]
}));
```

#### 方式二：使用CDK高级API自动授权
```typescript
// 在 data-stack.ts 中
usersTable.grantReadWriteData(userManagementFunction);
assessmentsTable.grantReadWriteData(questionsGenerator);
```

#### 方式三：创建独立策略后附加到角色
```typescript
// 在 auth-stack.ts 中
const policy = new Policy(this, 'lambdaPolicyUserPool', {
  statements: [...]
});
policy.attachToRole(postConfirmation.role);
```

### 2. 不同堆栈中的权限配置

#### AuthStack 权限配置
- **postConfirmation Lambda**: Cognito用户管理 + SSM参数访问
- **postAuthentication Lambda**: SSM参数访问 + DynamoDB写入权限
- **initSuperAdmin Lambda**: Cognito用户创建和组管理

#### DataStack 权限配置
- **userManagementFunction**: DynamoDB全权限 + Cognito用户管理 + SSM参数
- **changePasswordFunction**: DynamoDB写入 + Cognito密码管理 + SSM参数
- **questionsGenerator**: DynamoDB读写 + Bedrock全权限 + S3访问
- **assessmentLambdaRole**: 共享角色，Bedrock知识库完整权限
- **gradeAssessmentFn**: 仅Bedrock模型调用权限
- **其他Lambda**: 各自的DynamoDB表访问权限

#### RagPipelineStack 权限配置
- **bedrockExecutionRole**: Bedrock服务专用角色
- **lambdaRole**: OpenSearch Serverless + Bedrock + S3权限
- **documentProcessor**: DynamoDB + S3权限

#### LoggingStack 权限配置
- **logAggregatorFunction**: DynamoDB读写 + CloudWatch Logs
- **logQueryFunction**: DynamoDB读取 + CloudWatch Logs查询

### 3. 权限问题的根本原因

#### 问题1: 堆栈删除重建导致权限丢失
- CDK在重新部署时可能会创建新的IAM角色
- 如果使用了硬编码的角色ARN或名称，会导致权限断裂
- **解决方案**: 使用CDK引用而非硬编码

#### 问题2: 权限配置分散
- 权限配置分布在多个Stack中
- 缺乏统一的权限管理策略
- **当前状态**: 权限散布在auth-stack.ts, data-stack.ts, rag-pipeline-stack.ts等

#### 问题3: 依赖关系复杂
- Stack之间有复杂的权限依赖
- 部署顺序影响权限生效
- **风险**: 部分Lambda可能在权限未完全配置时就开始运行

### 4. 建议的改进方案

#### 短期解决方案
1. **确保权限完整性**: 检查所有Lambda函数的权限配置
2. **使用CDK引用**: 避免硬编码ARN和角色名
3. **添加权限验证**: 在Lambda函数中添加权限检查逻辑

#### 长期优化方案
1. **权限集中管理**: 创建专门的权限管理Stack
2. **最小权限原则**: 细化权限到具体资源
3. **权限审计**: 定期审计和清理不必要的权限

### 5. 当前已知的权限问题

#### 已修复
- ✅ Bedrock知识库权限 (bedrock:Retrieve等)
- ✅ OpenSearch Serverless权限配置

#### 可能存在的问题
- ⚠️ 跨Stack权限引用可能在重建时失效
- ⚠️ 某些Lambda可能缺少完整的DynamoDB权限
- ⚠️ SSM参数访问权限可能需要更新
