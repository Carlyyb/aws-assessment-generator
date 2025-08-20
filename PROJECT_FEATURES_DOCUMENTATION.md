# 项目功能文档 - AWS Assessment Generator

## 项目概述

AWS Assessment Generator 是一个基于 AWS 云服务的智能评估生成系统，支持教师创建课程、管理知识库、生成评估以及学生参与评估。系统基于 CDK 构建，使用 React + TypeScript 前端，GraphQL API，以及多种 AWS 服务。

---

## 最新更新记录

### 2025-08-21: 批量导入功能增强 - 支持管理员角色

- **功能描述**：扩展用户管理页面批量导入功能，增加管理员角色选择支持

- **修改位置**：
  - `ui/src/pages/UserManagement.tsx` - 批量导入Tab中的角色选择器增加管理员选项

- **技术实现**：
  - **类型定义更新**：将 `importRole` 状态类型从 `'students' | 'teachers'` 扩展为 `'students' | 'teachers' | 'admin'`
  - **角色选择器增强**：selectedOption 逻辑支持管理员角色显示，onChange 事件支持 admin 类型
  - **权限控制保持**：使用 `getAvailableRoleOptions()` 函数确保权限控制，只有超级管理员可以批量创建管理员用户

- **解决的问题**：
  - ✅ 批量导入功能仅支持学生和教师角色，无法批量创建管理员账户
  - ✅ 超级管理员需要批量管理管理员账户的需求

- **用户体验改进**：
  - 👥 超级管理员可以通过Excel批量导入管理员账户
  - 🔒 权限控制确保只有适当权限的用户可以选择管理员角色
  - 📊 统一的批量导入流程，支持所有可创建的用户角色

- **版本控制**：v1.6.1 - 批量导入管理员支持版本

### 2025-08-21: 用户管理和课程设置功能增强

- **功能描述**：增强用户管理页面Excel模板下载功能，添加课程管理页面课程设置功能

- **修改位置**：
  - `ui/src/pages/UserManagement.tsx` - 在批量导入Tab区域添加"下载Excel模板"按钮，支持CSV格式模板下载
  - `ui/src/pages/Courses.tsx` - 为每个课程添加"课程设置"按钮，弹窗可编辑课程描述
  - `upload-template.js` - 新建S3模板上传脚本（可选使用）

- **技术实现**：
  - **Excel模板下载**：前端生成CSV格式的用户导入模板，包含示例数据，点击按钮自动下载
  - **课程设置弹窗**：使用Cloudscape Modal组件，支持编辑课程描述，保存时调用updateCourse GraphQL mutation
  - **权限控制**：课程设置按钮仅对教师及以上权限用户可见
  - **状态管理**：使用React hooks管理弹窗状态和表单数据

- **解决的问题**：
  - ✅ 批量导入用户缺少模板文件，用户不知道格式
  - ✅ 课程创建后无法修改描述等属性
  - ✅ 提升用户体验，简化批量导入流程

- **用户体验改进**：
  - 📥 一键下载用户导入模板，包含格式说明和示例数据
  - ⚙️ 直观的课程设置入口，方便管理课程信息
  - 🎯 权限控制确保只有合适的用户能够修改课程设置

- **版本控制**：v1.6.0 - 用户管理和课程设置增强版本

### 2025-08-21: 系统清理和权限优化

- **功能描述**：删除LogManagement页面，修复用户创建问题，优化权限系统

- **修改位置**：
  - 删除 `ui/src/pages/LogManagement.tsx` 及相关路由引用
  - `ui/src/pages/UserManagement.tsx` - 修复phoneNumber字段问题，支持超级管理员创建admin用户
  - `lib/resolvers/createSingleUser.ts` - 增强权限检查，支持admin用户创建
  - `ui/src/utils/adminPermissions.ts` - 移除日志管理权限，优化权限结构

- **技术实现**：
  - **页面清理**：删除LogManagement页面及路由，简化系统结构
  - **用户创建修复**：移除GraphQL schema中不存在的phoneNumber字段，修复创建失败问题
  - **权限分级**：超级管理员可创建admin用户，普通管理员只能创建学生和教师
  - **代码优化**：清理重复代码，修复TypeScript类型错误

- **解决的问题**：
  - ✅ 超级管理员创建用户失败的GraphQL字段错误
  - ✅ 移除不需要的日志管理页面
  - ✅ 权限系统更加清晰和安全

- **版本控制**：v1.5.1 - 系统清理和权限优化版本

### 2025-08-20: CDK部署修复和权限系统完善
- **功能描述**：修复CDK部署错误，完善用户管理系统，实现admin-only账号创建和简化用户属性
- **修改位置**：
  - `lib/auth-stack.ts` - 创建新的UserPool V2避免不可变属性冲突，配置简化的用户属性和自注册禁用
  - `lib/lambdas/initSuperAdmin.ts` - 更新为使用simplified用户属性（preferred_username, custom:role）
  - `lib/resolvers/createSingleUser.ts` & `batchCreateUsers.ts` - 更新用户创建流程使用简化属性
  - `lib/schema.graphql` - 移除phoneNumber字段，添加BatchUserOutput类型，修复ExcelImportResult类型错误
  - `ui/src/utils/adminPermissions.ts` - 完善权限检查系统，使用Cognito用户组验证
- **技术实现**：
  - **CDK部署修复**：通过创建userPoolV2新实例解决UsernameAttributes不可变属性部署失败问题
  - **用户属性简化**：只保留name(preferred_username)、username、password、role、email(可选)，移除phoneNumber
  - **权限控制增强**：禁用自注册(selfSignUpEnabled: false)，只允许管理员创建账号
  - **GraphQL类型修复**：创建BatchUserOutput类型解决input类型不能用作output类型的错误
  - **超级管理员初始化**：部署时自动创建超级管理员账号，支持环境变量配置
- **解决的问题**：
  - ✅ CDK UsernameAttributes不可变属性部署失败
  - ✅ GraphQL schema中ExcelImportResult类型使用input类型作为output的错误  
  - ✅ 用户属性过于复杂，简化为必需字段
  - ✅ 自注册安全漏洞，改为admin-only创建模式
  - ✅ TypeScript编译错误和类型不匹配问题
- **部署结果**：
  - 🎉 CDK部署成功完成
  - 🔒 用户安全：只有管理员可以创建账号
  - 🏗️ 新UserPool: us-west-2_yUj2OmiXn
  - 🌐 应用URL: https://d1jcpgwv35lp8s.cloudfront.net
- **版本控制**：v1.5.0 - CDK部署修复和安全增强版本

### 2025-08-19: Cognito用户组权限系统实现
- **功能描述**：将硬编码的管理员邮箱列表权限系统迁移到基于AWS Cognito用户组的权限管理系统
- **修改位置**：
  - `ui/src/utils/adminPermissions.ts` - 完全重写权限检查逻辑，使用JWT token解析Cognito用户组
  - `lib/config/adminConfig.ts` - 简化用户角色枚举，移除硬编码邮箱列表
  - `lib/services/cognitoPermissionService.ts` - 新建Cognito权限服务，提供后端权限检查API
- **技术实现**：
  - **前端权限检查**：通过 `fetchAuthSession()` 获取ID token，解析JWT payload中的 `cognito:groups` 字段
  - **用户角色简化**：四种角色 - STUDENT (students), TEACHER (teachers), ADMIN (admin), SUPER_ADMIN (super_admin)
  - **权限层级**：学生 < 教师 < 管理员 < 超级管理员，高级别包含低级别所有权限
  - **类型安全**：定义 `CognitoTokenPayload` 接口，消除 `any` 类型使用
  - **React Hook**：提供 `useAdminPermissions()` Hook 用于组件中权限检查
- **权限映射**：
  - 学生：参与测试，查看测试结果
  - 教师：创建课程、管理知识库、设置测试
  - 管理员：用户管理、系统管理、Logo上传
  - 超级管理员：创建管理员、日志访问、完整权限控制
- **向后兼容**：保留原有权限检查函数接口，确保现有代码正常工作
- **版本控制**：v1.4.0 - Cognito权限系统版本

### 2025-08-19: 主题系统Logo支持和UI优化
- **功能描述**：完善主题系统，支持Logo上传和显示，修复学生列表显示问题，优化按钮设计
- **修改位置**：
  - `ui/src/components/ThemeSettings.tsx` - 添加Logo文件上传功能，支持JPG/PNG/SVG格式，最大2MB
  - `ui/src/App.tsx` - 在TopNavigation中显示自定义Logo
  - `ui/src/styles/logo.css` - 新增Logo样式文件
  - `lib/schema.graphql` - 修改Student类型，将firstName和lastName合并为name字段
  - `ui/src/pages/StudentList.tsx` - 修复学生列表显示和数据结构
  - `ui/src/components/GroupManagementClean.tsx` - 更新Student接口
  - `ui/src/pages/FindAssessments.tsx` - 为编辑和发布按钮添加图标，调整按钮顺序
- **实现细节**：
  - Logo上传支持本地文件选择，自动生成Base64预览URL
  - 文件类型验证：只允许image/jpeg、image/jpg、image/png、image/svg+xml
  - 文件大小限制：最大2MB
  - Logo显示在TopNavigation标题左侧，使用CSS定位
  - Student模型简化：移除firstName和lastName，统一使用name字段
  - 按钮优化：发布按钮添加status-positive图标，编辑按钮添加edit图标，发布按钮置于编辑按钮左侧
- **版本控制**：v1.3.0 - 主题系统增强版本

### 2025-08-19: TypeScript 类型错误修复
- **修复问题**：前端组件中的 TypeScript 类型错误
- **修复位置**：
  - `ui/src/components/KnowledgeBaseManager.tsx` - 添加缺失的 useCallback 导入，修复 GraphQL 响应类型
  - `ui/src/pages/Courses.tsx` - 修复 GraphQL 响应类型访问
- **修复内容**：
  - 添加 `useCallback` 导入到 React hooks
  - 使用类型守卫 `('data' in response)` 来安全访问 GraphQL 响应
  - 替换所有 `any` 类型为具体的接口类型
  - 内联 `loadKnowledgeBase` 中的函数调用以避免依赖循环
  - 使用正确的 Amplify Storage `list` API
  - 前后端编译均通过，无 TypeScript 错误

### 2025-08-19: 编译错误修复和依赖包兼容性
- **修复问题**：编译时出现多个依赖包错误
- **修复位置**：
  - `lib/lambdas/postConfirmation.ts` - 修复 @aws-lambda-powertools 导入路径
  - `lib/rag-pipeline/lambdas/event-handler/get-document.ts` - 替换缺失的第三方包
  - 新增 `lib/rag-pipeline/lambdas/event-handler/types.ts` - 本地类型定义
- **修复内容**：
  - 修复 LambdaInterface 导入路径：从 `/lib/esm/types` 改为 `/types`
  - 移除泛型类型参数过多的错误
  - 创建本地类型定义替换缺失的 `@project-lakechain` 包
  - 用文件扩展名检测替代 `file-type` 包依赖
  - 编译成功通过，无错误输出

### 2025-08-19: 知识库权限共享功能
- **功能描述**：修改知识库管理，使同一课程的知识库对所有教师开放
- **修改位置**：
  - `lib/resolvers/getKnowledgeBase.ts` - 改为按课程ID扫描而非用户+课程组合查询
  - `lib/rag-pipeline/lambdas/event-handler/kb/bedrockKnowledgeBase.ts` - 修改为检查现有知识库逻辑
  - `ui/src/components/KnowledgeBaseManager.tsx` - 使用共享文件路径
  - `ui/src/pages/ManageKnowledgeBases.tsx` - 使用共享文件路径
- **实现细节**：
  - 知识库查询不再限制 userId，允许跨教师访问
  - 文件上传路径从 `KnowledgeBases/{userId}/{courseId}/` 改为 `KnowledgeBases/shared/{courseId}/`
  - 后端首先检查是否已有知识库存在，避免重复创建

### 2025-08-19: 知识库创建错误处理优化
- **修复问题**：创建知识库时出现 "Cannot read properties of null (reading 'ingestionJobId')" 错误
- **修复位置**：
  - `ui/src/components/KnowledgeBaseManager.tsx`
  - `ui/src/pages/ManageKnowledgeBases.tsx` 
  - `lib/rag-pipeline/lambdas/event-handler/index.ts`
  - `lib/rag-pipeline/lambdas/event-handler/kb/bedrockKnowledgeBase.ts`
- **修复内容**：
  - 增强前端 GraphQL 响应错误检查
  - 添加后端 ingestion 响应验证
  - 改进错误消息提示
  - 确保返回值包含所有必要字段

---

## 核心功能模块

### 1. 用户认证与权限管理

#### 功能名称：用户认证系统
- **功能描述**：基于 AWS Cognito 的用户认证系统，支持教师和学生角色管理，以及管理员权限控制
- **输入**：用户邮箱、密码、用户角色
- **输出**：JWT 令牌、用户配置信息、权限级别
- **实现方式**：AWS Cognito User Pool + Identity Pool
- **使用示例**：
  ```typescript
  // 创建用户账户
  const signUp = await Auth.signUp({
    username: email,
    password: password,
    attributes: {
      email: email,
      'custom:role': 'teachers' // 或 'students'
    }
  });
  ```
- **依赖关系**：AWS Cognito、AWS IAM
- **已知问题与限制**：
  - 管理员权限基于硬编码邮箱列表
  - 不支持批量用户导入
- **未来扩展**：支持 SAML/OAuth 集成，批量用户管理

#### 功能名称：管理员权限系统
- **功能描述**：基于邮箱白名单的管理员权限控制，支持日志管理等高级功能访问
- **输入**：用户邮箱
- **输出**：权限级别、可访问功能列表
- **实现方式**：GraphQL resolver 检查邮箱白名单
- **使用示例**：
  ```typescript
  // 检查管理员权限
  const adminCheck = await client.graphql({
    query: CHECK_ADMIN_PERMISSIONS
  });
  ```
- **依赖关系**：用户认证系统
- **已知问题与限制**：权限配置不灵活，需要代码修改
- **未来扩展**：数据库驱动的权限配置

---

### 2. 课程管理系统

#### 功能名称：课程创建与管理
- **功能描述**：教师可以创建、编辑、删除课程，支持课程基本信息管理和知识库状态监控
- **输入**：课程名称、描述
- **输出**：课程ID、课程列表、知识库状态
- **实现方式**：DynamoDB 存储 + GraphQL API
- **代码位置**：
  - 前端：`ui/src/pages/Courses.tsx`
  - 后端：`lib/resolvers/upsertCourse.ts`
- **使用示例**：
  ```typescript
  // 创建课程
  const course = await client.graphql({
    query: upsertCourse,
    variables: { 
      input: { 
        name: "机器学习基础", 
        description: "介绍机器学习的基本概念和算法" 
      } 
    }
  });
  ```
- **依赖关系**：用户认证、DynamoDB
- **版本控制**：v0.1.0 初始版本
- **已知问题与限制**：
  - 不支持课程分类
  - 缺少课程封面图片
- **未来扩展**：课程分类、多媒体支持、课程模板

#### 功能名称：课程仪表板
- **功能描述**：提供课程统计信息，包括评估数量、知识库状态、最后活动时间
- **输入**：用户ID
- **输出**：课程统计数据、健康度指标
- **实现方式**：GraphQL 聚合查询
- **代码位置**：`ui/src/components/CourseDashboard.tsx`
- **依赖关系**：课程管理、评估系统、知识库管理
- **已知问题与限制**：统计数据实时性有限
- **未来扩展**：实时数据流、更多统计维度

---

### 3. 知识库管理系统

#### 功能名称：知识库创建与文档上传
- **功能描述**：教师可以为每个课程创建知识库，上传参考文档，系统自动处理文档并创建向量索引
- **输入**：课程ID、文档文件（PDF、DOC、TXT等）
- **输出**：知识库ID、处理状态、向量索引
- **实现方式**：AWS Bedrock Knowledge Base + S3 + OpenSearch
- **代码位置**：
  - 前端：`ui/src/components/KnowledgeBaseManager.tsx`
  - 后端：`lib/rag-pipeline/rag-pipeline-stack.ts`
- **使用示例**：
  ```typescript
  // 创建知识库
  const kb = await client.graphql({
    query: createKnowledgeBase,
    variables: {
      courseId: "course-123",
      locations: ["s3://bucket/path/to/document.pdf"]
    }
  });
  ```
- **依赖关系**：
  - AWS Bedrock (Titan Embeddings)
  - AWS S3
  - AWS OpenSearch Serverless
  - 课程管理系统
- **版本控制**：v0.1.0 基础版本
- **已知问题与限制**：
  - 文档处理时间较长（5-10分钟）
  - 支持的文件格式有限
  - 不支持增量更新
- **未来扩展**：支持更多文件格式、增量处理、文档版本控制

#### 功能名称：知识库状态监控
- **功能描述**：实时监控知识库创建和文档处理状态，提供详细的进度日志
- **输入**：知识库ID、任务ID
- **输出**：处理状态、进度百分比、详细日志
- **实现方式**：轮询 Bedrock API 状态
- **依赖关系**：知识库创建功能
- **已知问题与限制**：状态更新可能有延迟
- **未来扩展**：WebSocket 实时通知、更细粒度的进度跟踪

---

### 4. 评估模板系统

#### 功能名称：评估模板创建
- **功能描述**：教师可以创建可重用的评估模板，定义题目数量、难度分布、题目类型
- **输入**：模板名称、语言、评估类型、题目分布（简单/中等/困难）
- **输出**：模板ID、模板配置
- **实现方式**：DynamoDB 存储
- **代码位置**：`ui/src/pages/Templates.tsx`
- **使用示例**：
  ```typescript
  // 创建评估模板
  const template = await client.graphql({
    query: createAssessTemplate,
    variables: {
      input: {
        name: "标准测试模板",
        docLang: "zh",
        assessType: "multiChoiceAssessment",
        taxonomy: "Application",
        totalQuestions: 10,
        easyQuestions: 3,
        mediumQuestions: 5,
        hardQuestions: 2
      }
    }
  });
  ```
- **依赖关系**：用户认证、DynamoDB
- **已知问题与限制**：不支持自定义评分权重
- **未来扩展**：模板共享、智能推荐模板

---

### 5. 智能评估生成系统

#### 功能名称：AI驱动的题目生成
- **功能描述**：基于上传的课程文档和知识库，使用 AWS Bedrock 的 LLM 自动生成评估题目
- **输入**：课程ID、评估模板、课程文档、讲座日期
- **输出**：生成的题目集、标准答案、解释
- **实现方式**：
  - AWS Bedrock (Nova Lite 模型)
  - RAG (检索增强生成)
  - Lambda 函数处理
- **代码位置**：
  - 前端：`ui/src/pages/GenerateAssessments.tsx`
  - 后端：`lib/questions-generation/`
- **使用示例**：
  ```typescript
  // 生成评估
  const assessment = await client.graphql({
    query: generateAssessment,
    variables: {
      input: {
        name: "第一章测试",
        courseId: "course-123",
        lectureDate: "2024-01-15",
        deadline: "2024-01-22",
        locations: ["s3://bucket/lecture-materials.pdf"],
        assessTemplateId: "template-456"
      }
    }
  });
  ```
- **依赖关系**：
  - 知识库管理
  - 评估模板
  - AWS Bedrock
  - S3 文档存储
- **版本控制**：v0.1.0 基础生成功能
- **已知问题与限制**：
  - 生成质量依赖文档质量
  - 处理时间较长（2-5分钟）
  - 不支持图片题目
- **未来扩展**：多模态支持、题目质量评估、人工审核流程

#### 功能名称：评估生成进度监控
- **功能描述**：实时显示评估生成进度，包括文档处理、AI生成、后处理等阶段，生成完成后自动跳转到编辑页面
- **输入**：生成任务ID
- **输出**：进度百分比、当前步骤、详细日志、自动页面跳转
- **实现方式**：轮询Lambda执行状态 + React状态管理
- **代码位置**：`ui/src/pages/GenerateAssessments.tsx`
- **使用示例**：
  ```typescript
  // 检查生成状态并自动跳转
  if (status === AssessStatus.CREATED) {
    updateStep('✅ 测试生成完成！正在跳转到编辑页面...', 100);
    setIsGenerating(false);
    navigate(`/edit-assessment/${assessId}`);
  }
  ```
- **功能特性**：
  - 实时进度显示
  - 详细日志记录
  - 错误诊断信息
  - 调试模式支持
  - 自动跳转编辑页面
- **依赖关系**：智能评估生成、React Router
- **版本控制**：v0.2.0 增加自动跳转功能
- **已知问题与限制**：状态更新有延迟
- **未来扩展**：实时状态推送、WebSocket通知

---

### 6. 评估管理系统

#### 功能名称：评估编辑与发布
- **功能描述**：教师可以编辑生成的评估内容，调整题目，然后发布给学生
- **输入**：评估ID、编辑内容
- **输出**：更新的评估、发布状态
- **实现方式**：DynamoDB 存储 + GraphQL 更新
- **代码位置**：`ui/src/pages/EditAssessments.tsx`
- **使用示例**：
  ```typescript
  // 发布评估
  const published = await client.graphql({
    query: publishAssessment,
    variables: { assessmentId: "assessment-123" }
  });
  ```
- **依赖关系**：评估生成、学生管理
- **已知问题与限制**：不支持协作编辑
- **未来扩展**：版本控制、协作编辑、批量操作

#### 功能名称：评估生成后自动跳转
- **功能描述**：评估生成完成后自动关闭生成进度窗口，直接跳转到编辑页面，提升用户体验
- **输入**：生成完成的评估ID
- **输出**：页面跳转、进度窗口关闭
- **实现方式**：React状态管理 + 路由跳转
- **代码位置**：`ui/src/pages/GenerateAssessments.tsx`
- **使用示例**：
  ```typescript
  // 生成完成后自动跳转
  if (status === AssessStatus.CREATED) {
    updateStep('✅ 测试生成完成！正在跳转到编辑页面...', 100);
    setIsGenerating(false);
    navigate(`/edit-assessment/${assessId}`);
  }
  ```
- **依赖关系**：评估生成、React Router
- **版本控制**：v0.2.0 用户体验优化
- **已知问题与限制**：无
- **未来扩展**：支持自定义跳转选项

#### 功能名称：评估题目增减管理
- **功能描述**：在编辑评估页面支持添加新题目和删除现有题目，支持四种题目类型的自定义创建
- **输入**：题目类型、题目内容、选项、答案、解释（可选）
- **输出**：更新的评估内容、题目导航
- **实现方式**：React Reducer + 模态窗口组件
- **代码位置**：
  - 主页面：`ui/src/pages/EditAssessments.tsx`
  - 添加组件：`ui/src/components/AddQuestionModal.tsx`
- **使用示例**：
  ```typescript
  // 添加新题目
  const handleAddQuestion = (newQuestion: any, questionType: AssessType) => {
    wrappedUpdateAssessment({
      type: ActionTypes.Add,
      content: newQuestion,
      questionType
    });
  };
  
  // 删除题目
  wrappedUpdateAssessment({ 
    type: ActionTypes.Delete, 
    stepIndex: activeStepIndex 
  });
  ```
- **支持的题目类型**：
  - 单选题 (singleChoiceAssessment)
  - 多选题 (multiChoiceAssessment) 
  - 判断题 (trueFalseAssessment)
  - 问答题 (freeTextAssessment)
- **功能特性**：
  - 题目导航网格显示
  - 修改状态可视化指示
  - 支持题目间快速跳转
  - 表单验证和错误提示
- **依赖关系**：评估编辑系统、GraphQL API
- **版本控制**：v0.2.0 题目管理增强
- **已知问题与限制**：
  - 不支持题目重排序
  - 不支持题目模板
- **未来扩展**：拖拽排序、题目模板、批量操作、题目导入导出

#### 功能名称：自动评分系统
- **功能描述**：对学生提交的答案进行自动评分，支持客观题和主观题
- **输入**：学生答案、标准答案、评分标准
- **输出**：分数、详细反馈
- **实现方式**：AWS Bedrock LLM评分 + 规则引擎
- **代码位置**：`lib/lambdas/gradeAssessment.ts`
- **依赖关系**：评估系统、AWS Bedrock
- **已知问题与限制**：主观题评分准确性有限
- **未来扩展**：评分模型优化、人工复审

---

### 7. 学生评估系统

#### 功能名称：学生答题界面
- **功能描述**：学生可以查看已发布的评估，在线答题，提交答案
- **输入**：学生ID、评估ID、答案数据
- **输出**：提交状态、临时保存
- **实现方式**：React 表单 + DynamoDB 存储
- **代码位置**：`ui/src/pages/StudentAssessment.tsx`
- **使用示例**：
  ```typescript
  // 提交学生答案
  const submission = await client.graphql({
    query: upsertStudentAssessment,
    variables: {
      input: {
        parentAssessId: "assessment-123",
        answers: JSON.stringify(answerData),
        completed: true
      }
    }
  });
  ```
- **依赖关系**：用户认证、评估管理
- **已知问题与限制**：
  - 不支持离线答题
  - 缺少防作弊机制
- **未来扩展**：离线支持、防作弊机制

#### 功能名称：评估计时器系统
- **功能描述**：为评估提供计时功能，支持倒计时（有时间限制）和正计时（无时间限制），包含开始确认对话框、时间警告和自动提交功能
- **输入**：评估时间限制设置（timeLimited, timeLimit字段）
- **输出**：实时时间显示、时间警告提醒、自动提交
- **实现方式**：
  - React useRef + setInterval 计时器
  - 条件渲染（等待开始/答题中状态）
  - CloudScape ProgressBar 和 Alert 组件
- **代码位置**：`ui/src/pages/StudentAssessment.tsx`
- **使用示例**：
  ```typescript
  // 计时器状态管理
  const [remainingTime, setRemainingTime] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  
  // 开始计时器
  const startTimer = useCallback(() => {
    setHasStarted(true);
    if (isTimeLimited) {
      timerRef.current = setInterval(() => {
        setRemainingTime(prev => prev <= 1 ? 0 : prev - 1);
      }, 1000);
    }
  }, [isTimeLimited]);
  ```
- **功能特性**：
  - 开始确认对话框：防止误操作开始答题
  - 实时计时显示：倒计时显示剩余时间，正计时显示已用时间
  - 时间警告：剩余5分钟时弹出提醒
  - 进度条显示：可视化时间进度，剩余5分钟内变为红色警告色
  - 自动提交：时间到期自动提交答案
  - 计时器清理：提交后或组件卸载时清理计时器
- **依赖关系**：评估扩展字段（timeLimited, timeLimit）
- **已知问题与限制**：
  - 依赖客户端时间，可能存在作弊风险
  - 刷新页面会重置计时器
- **版本控制**：v1.0 - 2024年基础计时器功能
- **未来扩展**：
  - 服务端时间同步验证
  - 暂停/恢复功能
  - 页面刷新时恢复计时器状态

#### 功能名称：提交按钮与确认系统
- **功能描述**：将传统的Wizard导航替换为自定义的提交按钮系统，包含最终提交确认对话框和答题状态验证
- **输入**：用户答题数据、提交操作
- **输出**：提交确认界面、验证结果、最终提交状态
- **实现方式**：
  - 移除CloudScape Wizard组件，使用自定义Container布局
  - 单题显示模式，带上一题/下一题导航
  - 最后一题显示"提交答案"按钮
  - Modal对话框显示提交摘要和确认
- **代码位置**：`ui/src/pages/StudentAssessment.tsx`
- **使用示例**：
  ```typescript
  // 提交验证逻辑
  const validateSubmission = () => {
    const answeredCount = answers.filter(answer => answer !== undefined && answer !== '').length;
    const completionRate = answeredCount / questions.length;
    
    if (completionRate < 0.5) {
      return {
        canSubmit: true,
        showWarning: true,
        warningMessage: `您只完成了 ${Math.round(completionRate * 100)}% 的题目，确定要提交吗？`
      };
    }
    
    return { canSubmit: true, showWarning: false, warningMessage: '' };
  };
  
  // 最终提交处理
  const handleFinalSubmit = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    client.graphql({
      query: gradeStudentAssessment,
      variables: {
        input: {
          parentAssessId: params.id!,
          answers: JSON.stringify(answers.map((answer) => (isNaN(+answer) ? answer : +answer + 1))),
        },
      },
    }).then(({ data }) => setScore(data.gradeStudentAssessment.score));
  }, [answers, params.id]);
  ```
- **功能特性**：
  - 单题导航：每次只显示一道题目，使用上一题/下一题按钮导航
  - 提交确认：最后一题显示"提交答案"按钮，触发确认对话框
  - 答题摘要：显示完成情况、未答题目列表、答题用时
  - 智能验证：完成率低于50%时显示额外警告
  - 状态检查：实时显示已答题数、完成百分比
  - 防误操作：多重确认，清晰的提醒文案
- **依赖关系**：计时器系统、答题状态管理
- **已知问题与限制**：
  - 提交后无法撤销
  - 依赖客户端状态管理
- **版本控制**：v1.0 - 2024年基础提交确认系统
- **未来扩展**：
  - 草稿保存功能
  - 提交进度显示
  - 网络断开重连机制

#### 功能名称：评估结果真实数据查询
- **功能描述**：替换评估结果页面的模拟数据，使用真实的GraphQL查询获取学生评估结果和统计信息
- **输入**：评估ID
- **输出**：学生评估结果列表、评估基本信息、答题统计
- **实现方式**：
  - 使用listStudentAssessments GraphQL查询获取所有学生评估
  - 客户端筛选特定assessmentId的结果
  - 使用getAssessment查询获取评估基本信息
  - 结合ExtendedTypes类型处理数据兼容性
- **代码位置**：`ui/src/pages/AssessmentResults.tsx`
- **使用示例**：
  ```typescript
  const loadAssessmentResults = async () => {
    try {
      // 获取评估信息
      const assessmentResponse = await client.graphql<any>({
        query: getAssessment,
        variables: { id: params.id! }
      });
      
      const assessment = assessmentResponse.data.getAssessment;
      setAssessmentInfo(addAssessmentDefaults(assessment));
      
      // 获取所有学生评估结果
      const studentAssessmentsResponse = await client.graphql<any>({
        query: listStudentAssessments
      });
      
      const allStudentAssessments = studentAssessmentsResponse.data.listStudentAssessments || [];
      
      // 筛选当前评估的结果
      const currentAssessmentResults = allStudentAssessments
        .filter((sa: any) => sa.parentAssessId === params.id)
        .map((sa: any) => addStudentAssessmentDefaults(sa, assessment));
      
      setStudentResults(currentAssessmentResults);
    } catch (error) {
      dispatchAlert({ type: AlertType.ERROR, content: '加载评估结果失败' });
    }
  };
  ```
- **功能特性**：
  - 真实数据源：连接后端数据库，不再使用模拟数据
  - 错误处理：网络请求失败时显示友好错误信息
  - 数据筛选：从所有学生评估中筛选特定评估的结果
  - 类型安全：使用ExtendedTypes确保数据结构兼容性
  - 空状态处理：数据为空时显示合适的提示
  - 加载状态：显示loading状态提升用户体验
- **依赖关系**：GraphQL queries (getAssessment, listStudentAssessments)、ExtendedTypes
- **已知问题与限制**：
  - 查询所有学生评估后客户端筛选，数据量大时性能可能受影响
  - 依赖StudentAssessment数据结构包含用户信息
- **版本控制**：v1.0 - 2024年基础数据查询实现
- **未来扩展**：
  - 服务端筛选查询（按assessmentId查询）
  - 分页支持
  - 实时数据更新

#### 功能名称：成绩查看与反馈
- **功能描述**：学生可以查看已完成评估的成绩和详细反馈
- **输入**：学生ID、评估ID
- **输出**：分数、答题分析、改进建议
- **实现方式**：GraphQL 查询 + AI生成反馈
- **代码位置**：`ui/src/pages/ReviewAssessment.tsx`
- **依赖关系**：自动评分系统
- **已知问题与限制**：反馈质量依赖AI模型
- **未来扩展**：个性化学习建议、错题集

---

### 8. 日志管理与监控系统

#### 功能名称：系统日志聚合
- **功能描述**：收集和聚合所有系统组件的日志，提供统一的日志查看界面
- **输入**：CloudWatch 日志流
- **输出**：结构化日志数据、搜索索引
- **实现方式**：
  - CloudWatch Logs
  - Lambda 日志处理器
  - DynamoDB 日志存储
- **代码位置**：
  - 前端：`ui/src/pages/LogManagement.tsx`
  - 后端：`lib/logging-stack.ts`，`lib/lambdas/logging/`
- **使用示例**：
  ```typescript
  // 查询日志
  const logs = await client.graphql({
    query: QUERY_LOGS,
    variables: {
      input: {
        operation: 'getLogs',
        filters: {
          timeRange: '24h',
          level: 'ERROR',
          serviceName: 'questions-generator'
        }
      }
    }
  });
  ```
- **依赖关系**：
  - AWS CloudWatch
  - DynamoDB
  - 管理员权限系统
- **版本控制**：v0.1.0 基础日志功能
- **已知问题与限制**：
  - 日志查询性能有限
  - 不支持实时流式日志
- **未来扩展**：实时日志流、高级分析、告警系统

#### 功能名称：系统性能监控
- **功能描述**：监控系统性能指标，包括响应时间、错误率、资源使用情况
- **输入**：系统指标数据
- **输出**：性能仪表板、健康状态
- **实现方式**：CloudWatch 指标 + 自定义监控
- **依赖关系**：日志系统
- **已知问题与限制**：监控覆盖度不完整
- **未来扩展**：智能告警、性能优化建议

#### 功能名称：错误追踪与分析
- **功能描述**：自动检测和分析系统错误，提供错误详情和上下文信息
- **输入**：错误日志、堆栈跟踪
- **输出**：错误分类、影响分析、修复建议
- **实现方式**：日志分析 + 错误聚合
- **依赖关系**：日志聚合系统
- **已知问题与限制**：错误分类准确性需要改进
- **未来扩展**：AI驱动的错误分析、自动修复建议

---

### 9. 国际化(i18n)系统

#### 功能名称：多语言支持
- **功能描述**：支持中文和英文界面切换，提供本地化的用户体验
- **输入**：语言代码
- **输出**：本地化文本
- **实现方式**：i18n 文件 + React Context
- **代码位置**：`ui/src/i18n/`
- **使用示例**：
  ```typescript
  // 获取本地化文本
  const text = getText('teachers.settings.courses.create_success');
  ```
- **依赖关系**：React Context
- **已知问题与限制**：
  - 部分文本未翻译
  - 不支持动态语言包加载
- **未来扩展**：更多语言支持、动态翻译

---

### 10. 主题与样式系统

#### 功能名称：UI主题管理
- **功能描述**：基于 AWS Cloudscape 的一致性UI设计系统
- **输入**：主题配置
- **输出**：统一的UI组件样式
- **实现方式**：Cloudscape Design System
- **代码位置**：`ui/src/pages/ThemeDemo.tsx`
- **依赖关系**：@cloudscape-design/components
- **已知问题与限制**：主题定制能力有限
- **未来扩展**：自定义主题、暗色模式

---

## 技术栈总览

### 前端技术
- **React 18** + TypeScript
- **AWS Cloudscape Design System**
- **AWS Amplify** (认证和API)
- **Vite** (构建工具)

### 后端技术
- **AWS CDK** (基础设施即代码)
- **AWS AppSync** (GraphQL API)
- **AWS Lambda** (无服务器计算)
- **AWS DynamoDB** (NoSQL数据库)
- **AWS Cognito** (用户认证)

### AI/ML服务
- **AWS Bedrock** (大语言模型)
  - Amazon Nova Lite (文本生成)
  - Amazon Titan Embeddings (向量嵌入)
- **AWS OpenSearch Serverless** (向量搜索)

### 存储和数据
- **AWS S3** (文件存储)
- **AWS DynamoDB** (结构化数据)
- **AWS CloudWatch** (日志和监控)

---

## 部署和运维

### 标准部署
```bash
npm ci
npx cdk bootstrap --qualifier gen-assess
npm run cdk deploy
```

### 带日志系统的部署
```bash
# Windows
.\deploy-logging.ps1

# Linux/Mac
./deploy-logging.sh
```

### 环境要求
- Node.js >= 20.0.0
- AWS CLI 已配置
- CDK v2.211.0
- Docker (用于构建Lambda)

---

## 已知问题与改进建议

### 高优先级问题
1. **性能优化**：评估生成时间过长，需要优化AI处理流程
2. **错误处理**：需要更完善的错误恢复机制
3. ~~**用户体验**：知识库创建流程需要简化~~ ✅ **已改进**：评估生成完成后自动跳转到编辑页面，提升用户体验

### 中优先级改进
1. **功能完善**：~~增加批量操作~~、模板共享等功能 ✅ **部分完成**：已支持题目增减管理
2. **监控增强**：完善系统监控和告警机制
3. **安全加固**：添加更多安全防护措施
4. **题目管理**：~~支持题目编辑~~ ✅ **已完成**：支持添加、删除、编辑题目功能

### 低优先级扩展
1. **移动端支持**：开发移动应用
2. **集成能力**：支持与LMS系统集成
3. **高级分析**：添加学习分析和报告功能

---

## 版本历史

- **v0.2.0** (2025年8月19日)
  - **评估生成体验优化**：生成完成后自动关闭进度窗口并跳转到编辑页面
  - **题目管理增强**：在编辑页面支持添加和删除题目功能
  - **题目类型支持**：支持自定义创建单选、多选、判断、问答四种题目类型
  - **可视化导航**：添加题目导航网格，支持快速跳转和修改状态指示
  - **用户体验改进**：表单验证、错误提示、操作反馈等细节优化

- **v0.1.0** (基础版本)
  - 基础功能实现
  - 日志管理系统
  - 多语言支持
  - AWS Bedrock 集成

---

此文档提供了项目所有已实现功能的详细说明，包括技术实现、使用方式、依赖关系和改进建议。建议定期更新此文档以反映项目的最新状态。
