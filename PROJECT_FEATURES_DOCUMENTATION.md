# 项目功能文档 - AWS Assessment Generator

## 项目概述

AWS Assessment Generator 是一个基于 AWS 云服务的智能评估生成系统，支持教师创建课程、管理知识库、生成评估以及学生参与评估。系统基于 CDK 构建，使用 React + TypeScript 前端，GraphQL API，以及多种 AWS 服务。

---

## 最新更新记录

### 2025-08-25: TopNavigation Utilities组件主题色适配

- **功能名称**：修复TopNavigation utilities组件背景色适配问题
- **问题描述**：TopNavigation的utilities组件（用户菜单区域）没有应用主题预览中导航栏的背景色
- **解决方案**：
  - 为utilities相关的CSS选择器添加 `background-color: var(--color-background-top-navigation)` 样式
  - 修改以下CSS选择器确保完整覆盖：
    - `[data-awsui-context="top-navigation"] [class*="utilities"]`
    - `.awsui-top-navigation-utilities`，`[class*="awsui-top-navigation-utilities"]`
    - `.awsui-top-navigation-utility`，`[class*="awsui-top-navigation-utility"]`
    - `.awsui-top-navigation [class*="utility"]`等
- **技术实现**：
  - 使用主题变量 `var(--color-background-top-navigation)` 确保与主题预览一致
  - 保持现有的文字颜色 `#ffffff` 确保对比度
  - 通过 `!important` 确保样式优先级
- **影响范围**：TopNavigation用户菜单区域的视觉效果
- **文件变更**：
  - 修改：`ui/src/styles/theme.css`
- **构建状态**：✅ 样式修改无需重新编译
- **版本控制**：2025-08-25 utilities主题色适配完成

### 2025-08-25: S3-based全局Logo管理系统

- **功能名称**：实现基于AWS S3的全局Logo管理系统，解决多个logo同时加载的跳动问题
- **问题背景**：
  - 原有logo系统使用base64和URL存储在localStorage和云端设置中
  - 出现多个logo同时加载并且不停跳动的状况
  - Logo文件缺乏统一管理，存在重复上传和存储混乱问题
- **解决方案**：
  1. **新建LogoManager S3管理器**：
     - 创建 `ui/src/utils/logoManager.ts` 单例模式管理器
     - 实现固定目录结构：`global-logos/current-logo.{ext}`
     - 自动清理旧logo文件，确保只保留一个当前logo
     - 支持文件上传、URL上传、删除等完整操作
  2. **ThemeContext集成S3服务**：
     - 更新 `setGlobalLogo()` 函数集成LogoManager
     - 新增 `uploadGlobalLogoFile()` 直接文件上传功能
     - 新增 `deleteGlobalLogo()` logo删除功能
     - 优先从S3加载logo，localStorage作为备份
  3. **增强设置页面UI**：
     - 在 `EnhancedThemeSettings.tsx` 中添加文件上传控件
     - 支持拖拽上传和点击选择文件
     - 文件类型验证（仅支持图片格式）和大小限制（5MB）
     - 保留URL输入方式用于向后兼容
- **技术实现**：
  - **LogoManager类**：单例模式，封装所有S3 logo操作
  - **S3存储策略**：固定路径 `global-logos/current-logo.{ext}`，自动清理机制
  - **错误处理**：完整的异常捕获和用户友好的错误提示
  - **向后兼容**：支持base64和URL方式的旧logo数据
- **用户体验提升**：
  - 消除logo跳动和重复加载问题
  - 支持直接文件上传，无需手动转换URL
  - 文件验证和大小限制提升安全性
  - 直观的上传进度和状态反馈
- **文件变更**：
  - 新增：`ui/src/utils/logoManager.ts`
  - 修改：`ui/src/contexts/ThemeContext.tsx`, `ui/src/components/EnhancedThemeSettings.tsx`
- **构建状态**：✅ TypeScript编译通过，无错误
- **部署兼容性**：完全向后兼容现有logo数据，自动迁移到S3存储

### 2025-08-25: Assessment Update 系统重构与错误修复

- **功能名称**：新增 updateAssessment mutation 并重构 Assessment 更新逻辑
- **问题背景**：
  - `upsertAssessment` 使用 `ddb.put` 操作会覆盖整个项目
  - 在更新时如果缺少 `name`、`courseId` 等非空字段会导致 GraphQL 错误
  - AssessmentSettings 页面更新设置时出现 "Cannot return null for non-nullable type" 错误
- **解决方案**：
  1. **新增 updateAssessment mutation**：
     - 创建专用的 `UpdateAssessmentInput` 类型，所有字段为可选（除 id）
     - 实现 `updateAssessment` resolver 使用 `ddb.update` 操作
     - 只更新传入的字段，不影响其他字段
  2. **重构 upsertAssessment**：
     - 明确用于创建新 Assessment 的场景
     - 确保在创建时正确设置 `createdAt` 和 `updatedAt` 字段
  3. **前端逻辑分离**：
     - AssessmentSettings.tsx 使用 `updateAssessment` 进行设置更新
     - EditAssessments.tsx 保持使用 `upsertAssessment` 进行创建/完整更新
- **技术实现**：
  - **GraphQL Schema**: 添加 `UpdateAssessmentInput` 和 `updateAssessment` mutation
  - **Resolver**: 创建 `lib/resolvers/updateAssessment.ts` 使用 `ddb.update`
  - **CDK**: 在 `data-stack.ts` 中注册新的 resolver
  - **前端**: 在 `mutations.ts` 中添加 `updateAssessment` GraphQL 查询
- **文件变更**：
  - 新增：`lib/resolvers/updateAssessment.ts`
  - 修改：`lib/schema.graphql`, `lib/data-stack.ts`, `ui/src/graphql/mutations.ts`, `ui/src/pages/AssessmentSettings.tsx`
- **影响范围**：修复 AssessmentSettings 更新失败问题，提升数据操作安全性
- **构建状态**：✅ TypeScript 编译通过
- **版本控制**：2025-08-25 Assessment Update 重构完成

### 2025-08-25: 主题系统与Logo系统全面升级

- **功能名称**：主题系统从基础4色升级到详细设计令牌系统 + Logo显示优化
- **升级范围**：完整的主题架构重构，从 `CustomTheme` 升级到 `DetailedTheme`
- **技术实现**：
  1. **DetailedTheme 接口**：
     - 从4个基本颜色扩展到26个精细设计令牌
     - 覆盖全局、按钮、导航、输入框、状态等所有UI元素
     - 基于Cloudscape设计系统标准
  2. **EnhancedThemeSettings 组件**：
     - 可视化主题编辑器，支持Tab式分类设置
     - 实时颜色选择器和主题预览
     - 自定义主题创建、编辑、删除功能
  3. **CSS变量动态注入**：
     - App.tsx 中实现所有设计令牌的CSS变量自动注入
     - 实时主题切换无需页面刷新
  4. **Logo系统重构**：
     - 移除所有自定义CSS定位方案
     - 采用Cloudscape TopNavigation identity.logo 官方属性
     - 消除logo显示冲突和布局问题
- **用户体验提升**：
  - 6个内置主题（YAS Blue、Cloudscape Light/Dark、Education Blue等）
  - 细粒度颜色控制（26个设计令牌）
  - 稳定的Logo显示效果
  - 专业的主题编辑界面
- **技术债务清理**：
  - 移除旧的Mantine依赖组件
  - 清理冲突的CSS样式
  - 向后兼容旧主题数据格式
- **文件影响**：
  - 核心：`ThemeContext.tsx`, `App.tsx`, `EnhancedThemeSettings.tsx`
  - 样式：`theme.css`, `logo.css` (清理)
  - 移除：`ThemeCustomizer-old.tsx`, `ThemeSettings-old.tsx` 等旧组件
- **构建状态**：✅ 成功构建，无TypeScript错误
- **部署兼容性**：完全向后兼容，现有用户数据无损升级

### 2025-08-24: GraphQL Null 安全性增强与查表错误防护

- **功能名称**：系统性解决 "Cannot return null for non-nullable type" GraphQL 错误
- **问题背景**：
  - 项目中频繁出现 GraphQL 查询错误：`Cannot return null for non-nullable type: 'AWSDateTime'/'Assessment'` 等
  - 这些错误主要由数据库记录缺少 Schema 中定义的非空字段，或字段值为 `null` 导致
  - 错误会导致整个查询失败，影响用户体验和系统稳定性
- **解决方案**：
  1. **放宽 GraphQL Schema 约束**：
     - 将 `Assessment` 类型中的 `updatedAt` 字段从必需 (`!`) 改为可选
     - 将 `StudentAssessment` 类型中的 `answers` 字段从必需改为可选
     - 将所有题型 Input 中的 `explanation` 字段从必需改为可选
  2. **前端默认值增强**：
     - 增强 `addAssessmentDefaults()` 函数，处理 null/undefined 情况
     - 增强 `addStudentAssessmentDefaults()` 函数，支持空值参数
     - 为所有可能为空的字段提供合理的默认值
  3. **后端空值安全查询**：
     - 创建 `lib/utils/nullSafeQuery.ts` 工具库
     - 提供 `NullSafeQueryResult` 包装器类，支持错误处理和默认值
     - 实现 `fillAssessmentDefaults()` 和 `fillStudentAssessmentDefaults()` 函数
     - 在数据转换 Lambda 中应用空值安全处理
- **技术实现**：
  - **Schema 修改** (`lib/schema.graphql`)：移除关键字段的 `!` 约束
  - **前端类型增强** (`ui/src/types/ExtendedTypes.ts`)：完善默认值处理逻辑
  - **后端工具库** (`lib/utils/nullSafeQuery.ts`)：提供统一的空值安全查询方法
  - **Lambda 增强** (`lib/lambdas/transformAssessmentData.ts`, `lib/lambdas/listStudentAssessmentsByParentAssessId.ts`)：应用空值安全处理
- **影响范围**：
  - 所有 Assessment 和 StudentAssessment 查询操作
  - 前端 AssessmentResults 页面不再因缺少字段而崩溃
  - 后端 API 返回数据更加健壮和一致
- **默认值策略**：
  - `updatedAt`: null（如果缺失）
  - `answers`: null（如果缺失）
  - `explanation`: null（如果缺失）
  - `timeLimited`: false
  - `timeLimit`: 120
  - `allowAnswerChange`: true
  - `studentGroups`: ['ALL']
  - `attemptLimit`: 1
  - `scoreMethod`: 'highest'
- **版本控制**：v1.11.0
- **已知问题与限制**：
  - 需要定期检查生产环境中的数据完整性
  - 建议在数据写入时就确保字段完整性
- **未来扩展**：
  - 可以考虑在数据写入时添加 Schema 验证
  - 建立监控机制，追踪字段缺失情况

### 2025-08-24: 取消发布测试修复（避免字段丢失）

- **功能名称**：修复取消发布测试时导致字段全部消失的问题
- **问题背景**：
  - 取消发布操作后，Assessment 记录只剩下 `published` 和 `status` 两个字段
  - 其他所有字段（如 `name`、`courseId`、`deadline` 等）都被清空
  - 同时会删除所有学生的历史测试数据，造成数据丢失
- **根本原因**：
  - `unpublishAssessment` Lambda 使用错误的 `userId`（调用者ID）作为主键
  - 当 `userId` 不匹配时，DynamoDB UpdateItem 会创建新记录而不是更新现有记录
  - 新记录只包含 UpdateExpression 中指定的字段
- **解决方案**：
  1. **使用 GSI 查找真实 ownerUserId**：
     - 通过 `id-only` GSI 根据 `assessmentId` 查找原始记录
     - 获取真实的 `ownerUserId` 作为主键进行更新
  2. **添加存在性条件**：
     - 使用 `ConditionExpression: 'attribute_exists(id) AND attribute_exists(userId)'`
     - 确保只更新现有记录，避免创建新记录
  3. **保留学生历史数据**：
     - 移除删除 StudentAssessments 表记录的逻辑
     - 保留学生的答题历史和分数记录
  4. **权限校验增强**：
     - 非管理员只能操作自己创建的测试
     - 管理员可以操作任何测试
- **技术实现**：
  - **修改文件**：`lib/lambdas/unpublishAssessment.ts`
  - **移除依赖**：不再需要 `studentAssessmentsTable` 环境变量
  - **查询优化**：使用 QueryCommand 替代直接的 UpdateItem
  - **错误处理**：明确的日志记录和错误返回
- **影响范围**：
  - 取消发布操作不再清空测试数据
  - 学生的历史答题记录得到保护
  - 管理员和教师的权限控制更加精确
- **版本控制**：v1.11.1
- **已知问题与限制**：
  - 需要 AssessmentsTable 存在 `id-only` GSI
  - 依赖 GSI 的数据一致性
- **未来扩展**：
  - 可以考虑添加"软删除"功能，标记测试为不可见而不是真正删除
  - 增加操作审计日志

### 2025-08-24: 停用 FreeText 题型生成 Prompt（后端提示精简）

- 功能名称：关闭 FreeText 题型生成相关提示文本
- 功能描述：
  - 由于前端暂不再发起 FreeText 题目生成请求，后端生成 Prompt 中移除了与 FreeText（简答题）相关的说明与 XML rubric 示例片段，以减少大模型上下文长度和推理成本。
- 修改位置：
  - `lib/questions-generation/lambdas/event-handler/services/prompts.ts`
    - `getInitialQuestionsPrompt()`：删除 FreeText 题型说明与 `<rubric>` 模板插入逻辑。
    - `improveQuestionPrompt()`：删除 FreeText 题型 `<rubric>` 模板片段。
- 输入/输出：
  - 输入类型未变更；GraphQL Schema 未变更。
  - 当 `assessType` 为 `freeTextAssessment` 时，不再插入 FreeText 专属说明与 XML 模板（当前前端不会发送此类型的生成请求）。
- 依赖关系：
  - 无 Schema 变更；不需要更新 `ui/src/graphql/queries.ts` / `mutations.ts`。
- 已知问题与限制：
  - 如未来重新启用 FreeText 题型，需要恢复相应 Prompt 片段与模板。
- 版本控制：v1.10.1
- 未来扩展：
  - 可将各题型 Prompt 片段组件化，按需组装，进一步缩短无关上下文。

### 2025-08-23: 评分分数返回修复、日志记录与评审界面增强
- 功能描述：
  - 修复 gradeStudentAssessment 在判断题/单选题时返回分数为 null 的问题，确保始终返回百分制 `score`。
  - 审阅页新增解析区域展示：对错符号（√/×）、“你的答案”与“正确答案”。
  - 输入：`StudentAssessmentInput`（不变）。
  - 输出：`StudentAssessment`，其中 `score` 保障非空（按题型计算的百分比）。
  - 后端：`lib/lambdas/gradeAssessment.ts` 增加 `gradeTrueFalse`、`gradeSingleAnswer` 并统一返回 `{ score }`；日志示例：`student1003+2025-08-23T10:10:34.506Z+期末测试+80%`。
- 依赖关系：前端 GraphQL 类型 `ui/src/graphql/API.ts`（已存在）；不涉及 schema 变更。
- 已知问题与限制：
  - CloudWatch 日志搜索可以直接用完整复合字符串或其中任意片段。
- 版本控制：v1.10.0
- 未来扩展：
  - 在日志中追加 `parentAssessId` 与 `userId`，支持更精细化检索；
  - 审阅页支持查看每题得分与多选题部分得分细节。

### 2025-08-23: EditAssessments 无限刷新与 i18n 日志刷屏修复

- 功能名称：编辑试卷页面无限刷新修复
- 功能描述：修复 `EditAssessments` 页面因副作用依赖不当导致的重复拉取 assessment 数据、页面不断刷新以及控制台持续输出 i18n 缺失日志的问题。
- 技术细节：
  - 调整数据加载 `useEffect` 依赖：从 `[params.id, setOverride]` 精简为 `[params.id]`，避免 `setOverride` 引用变化触发重复请求。
  - 增加 `cancelled` 守卫，防止组件卸载后继续 `setState` 引发的异常重渲染。
  - 清理面包屑覆盖的 `useEffect` 同步精简依赖，避免重复注册/清理。
- 影响范围：`ui/src/pages/EditAssessments.tsx`
- 已知问题与限制：若外部 context 提供的 `setOverride/removeOverride` 引用在运行时频繁变化，仍建议保持其稳定性；当前前端已规避此问题。
- 版本控制：v1.9.1
- 未来扩展：引入请求层去抖或缓存策略，进一步降低不必要的网络请求。

### 2025-08-23: Assessment 设置页保存输入修复与学生分组 API 对接

- 功能名称：Assessment 设置保存修复 & 学生分组真实 API 对接
- 功能描述：
  - 修复 AssessmentSettings 页面保存时报错 “The variables input contains a field that is not defined for input object type 'AssessmentInput'”。
  - 移除前端模拟分组数据，改为调用后端 `listStudentGroups` 查询，展示真实的学生分组（包含系统默认分组 ALL）。
- 输入/输出：
  - 输入：AssessmentInput（仅包含 schema 中允许的字段：id、name、courseId、lectureDate、deadline、assessType、各题型、published、status、timeLimited、timeLimit、allowAnswerChange、studentGroups、courses、attemptLimit、scoreMethod）。
  - 输出：Assessment（保持既有字段）。
  - 分组查询输出：`[StudentGroup]`，含 id、name、description、color、createdBy、teachers、students、createdAt。
- 使用示例：
  - 前端：`ui/src/pages/AssessmentSettings.tsx` 在保存时仅构造允许的 AssessmentInput 字段；加载时调用 `listStudentGroups` 获取分组列表。
- 依赖关系：
  - GraphQL Schema：`lib/schema.graphql`（AssessmentInput 已包含扩展字段；Query 含 `listStudentGroups`）。
  - Resolvers：`lib/resolvers/listStudentGroups.ts`；Lambda：`lib/lambdas/userManagement.ts`（operation: listStudentGroups）。
  - 基础设施：`lib/data-stack.ts` 已将 `listStudentGroups` 绑定到 Lambda 数据源，并配置 StudentGroups 表权限。
- 已知问题与限制：
  - `listStudentGroups` 需管理员/超级管理员/教师角色方可访问；无权限将返回错误。
  - `ui/src/graphql/queries.ts` 的 `getAssessment` 未选择扩展字段，前端通过默认值填充；如需显示已保存的扩展字段，可在未来调整查询选择集。
- 版本控制：v1.9.0
  - 变动日志：
    - 修复保存时 AssessmentInput 字段越界导致的 GraphQL 变量校验错误。
    - AssessmentSettings 对接真实分组查询 API，移除模拟数据。
- 未来扩展：
  - 在 `getAssessment` 查询中选择扩展设置字段，以在编辑时回显已保存设置。
  - 分组选择支持搜索、按教师过滤等能力。

### 2025-08-23: 多选题AI生成强化约束

- **功能描述**：强化多选题AI生成的约束条件，确保AI必须为每道多选题生成至少2个正确答案
- **核心改进**：
  - **强制要求**：多选题必须有至少2个正确答案（最少2个，最多4个）
  - **严格约束**：禁止在多选题评估中出现单一正确答案的题目
  - **明确指导**：在prompt中添加具体示例和要求说明
- **技术实现**：
  - **Prompt 增强** (`lib/questions-generation/lambdas/event-handler/services/prompts.ts`)：
    - 在 `getInitialQuestionsPrompt()` 中添加强制要求说明
    - 在 `improveQuestionPrompt()` 中添加相同约束
    - 更新XML格式示例，明确显示多个正确答案
  - **约束细节**：
    - 明确标明"MANDATORY REQUIREMENT"和"STRICT requirement"
    - 提供具体示例：如[1,3]、[2,3,4]、[1,2,4]等格式
    - 在XML模板中添加注释说明可添加更多correctAnswer标签
- **影响范围**：
  - 影响所有新生成的多选题评估
  - 影响通过知识库改进的多选题
  - 确保多选题的教学价值和评估质量
- **教学价值**：
  - 真正体现多选题的特点，避免伪装的单选题
  - 提高学生批判性思维和综合分析能力
  - 更好地评估学生对知识点的全面掌握

### 2025-08-23: 班级管理权限控制功能

- **功能描述**：为班级管理系统添加细粒度权限控制，允许管理员设置每个班级的可访问老师列表
- **核心功能**：
  - **权限管理**：
    - 管理员可以为每个班级设置可访问的老师列表
    - 班级创建者默认拥有访问权限
    - 只有可访问老师和管理员可以管理班级学生
    - 所有管理员始终拥有所有班级的完整权限
  - **前端界面**：
    - 在班级管理页面添加"管理权限"按钮
    - 权限管理弹窗显示所有可用老师的复选框列表
    - 实时更新权限设置，立即生效
- **技术实现**：
  - **GraphQL Schema 更新** (`lib/schema.graphql`)：
    - Class 类型新增 `accessibleTeachers: [String!]!` 字段
    - 新增 `UpdateClassPermissionsInput` 输入类型
    - 新增 `updateClassPermissions` mutation
  - **Lambda 函数增强** (`lib/lambdas/classManagement.ts`)：
    - 新增 `hasClassAccess()` 权限检查函数
    - 新增 `updateClassPermissions()` 权限更新函数
    - 修改 `listClassesByTeacher()` 支持基于权限的班级筛选
    - 在学生管理操作中集成权限验证
  - **数据库结构**：
    - Classes 表新增 `accessibleTeachers` 字段存储老师用户名数组
    - 保持数据完整性：班级创建者始终包含在可访问列表中
  - **前端组件** (`ui/src/pages/ClassManagement.tsx`)：
    - 新增老师选择界面
    - 集成权限管理模态框
    - 更新班级列表查询以包含权限信息
- **权限逻辑**：
  - **创建班级**：创建者自动获得访问权限
  - **查看班级**：用户只能看到有权限访问的班级
  - **管理学生**：只有有权限的老师可以添加/移除学生
  - **权限设置**：只有管理员可以修改班级权限
- **用户体验**：
  - 权限设置界面友好，支持批量选择老师
  - 即时生效，无需页面刷新
  - 清晰的权限状态显示
- **安全性**：
  - 后端验证所有权限操作
  - 防止越权访问和操作
  - 确保数据安全和隔离

### 2025-08-23: 用户登录时间记录功能

- **功能描述**：实现用户登录时自动记录最后登录时间到用户表的 `lastLoginAt` 字段
- **实现方式**：
  - 使用 AWS Cognito PostAuthentication 触发器
  - 在用户成功登录后自动执行 `postAuthentication` Lambda 函数
  - 根据用户角色更新对应的数据表（Users表或Students表）
- **技术实现**：
  - **Lambda 函数** (`lib/lambdas/postAuthentication.ts`)：
    - 监听 Cognito PostAuthentication 事件
    - 获取用户ID和角色信息
    - 使用北京时间格式记录登录时间
    - 分别处理学生和其他用户的数据更新
  - **权限配置** (`lib/auth-stack.ts`)：
    - Lambda 具有 DynamoDB UpdateItem 权限
    - 可访问所有 gen-assess 相关表
    - 通过 SSM Parameter Store 获取表名
  - **错误处理**：
    - 使用条件表达式确保记录存在才更新
    - 记录详细日志用于调试
    - 错误不会阻止用户登录流程
- **数据库字段**：
  - `lastLoginAt`: AWSDateTime 类型，记录最后登录时间
  - 使用 `createTimestamp()` 函数生成标准时间格式
- **影响范围**：
  - 所有用户登录时自动触发
  - 支持学生和教师/管理员的不同表结构
  - 提供用户活跃度统计基础数据
- **调试功能**：
  - Lambda 函数包含详细的日志记录
  - 记录用户ID、角色和登录时间
  - 区分成功更新和记录不存在的情况

### 2025-08-23: i18n 国际化文本缺失修复

- **功能描述**：修复了编辑测试页面和学生测试页面中 i18n 文本缺失导致的错误和页面重复刷新问题
- **问题分析**：
  1. **listAssessments GraphQL 查询错误**：resolver 返回错误格式导致 "type mismatch error, expected type LIST"
  2. **i18n 键缺失**：多个页面使用了未定义的 i18n 键，导致 `getText()` 函数返回错误
  3. **硬编码文本**：部分页面仍使用硬编码的中文文本，未使用 i18n 系统
  4. **页面重复刷新**：i18n 键缺失时组件可能进入无限重渲染循环
- **修改位置**：
  - `lib/resolvers/listAssessments.ts` - 修复 resolver 返回格式
  - `ui/src/i18n/zh.json` 和 `ui/src/i18n/en.json` - 补充缺失的 i18n 键
  - `ui/src/pages/EditAssessments.tsx` - 替换硬编码文本为 i18n
  - `ui/src/pages/StudentAssessment.tsx` - 替换硬编码文本为 i18n
- **修复内容**：
  - **GraphQL Resolver 修复**：
    ```typescript
    // 修复前：返回 ctx.result（包含 items, count 等）
    return ctx.result;
    // 修复后：返回 ctx.result.items（数组格式）
    return ctx.result.items;
    ```
  - **新增 i18n 键**：
    - `teachers.assessments.edit.add_question`: "添加题目" / "Add Question"
    - `students.assessment.preview.*`: 预览模式相关文本
    - `students.assessment.start.*`: 开始评估相关文本
    - `students.assessment.submit.*`: 提交确认相关文本
    - `students.assessment.timer.*`: 计时器相关文本
    - `students.assessments.detail.choose_multiple_answers`: 多选题提示文本
  - **硬编码文本替换**：
    - 编辑页面：`"添加题目"` → `getText('teachers.assessments.edit.add_question')`
    - 学生页面：`"预览模式 - 开始评估"` → `getText('students.assessment.preview.start_assessment')`
    - 等待页面：`"等待开始"` → `getText('students.assessment.start.waiting')`
- **技术改进**：
  - DynamoDB Scan 操作正确返回数组格式，符合 GraphQL LIST 类型要求
  - i18n 文本完整性提升，支持中英文双语
  - 消除硬编码文本，提高代码维护性
  - 解决页面重复渲染问题
- **影响范围**：修复影响所有使用 listAssessments 查询的页面，以及编辑测试和学生测试页面的用户体验

### 2025-08-23: 编辑测试页面功能修复

- **功能描述**：全面修复 EditAssessments 页面的多个功能问题，提升用户体验
- **修复内容**：
  1. **移除特定 AWS UI CSS 类**：
     - 在 `ui/src/index.css` 中添加 CSS 规则隐藏以下类：
       - `awsui_trigger-wrapper_hyvsj_zz5e8_1289`
       - `awsui_show-tools_hyvsj_zz5e8_1108` 
       - `awsui_has-tools-form_hyvsj_zz5e8_1086`
     - 使用 `display: none !important` 强制隐藏
  
  2. **修复右侧工具栏空白问题**：
     - 为 `AppLayout` 添加 `tools` 属性，提供丰富的工具栏内容
     - 工具栏包含：快速操作按钮、评估信息展示、未保存更改提醒
     - 添加 `toolsOpen` 和 `onToolsChange` 状态管理
     - 设置 `toolsWidth={300}` 指定工具栏宽度
  
  3. **解决无限刷新问题**：
     - 修复 `useEffect` 依赖数组，避免 `updateAssessment` 函数引起的循环
     - 直接使用 `dispatch` 避免循环依赖：`dispatch({ type: ActionTypes.Put, content })`
     - 添加 `isDataLoaded` 状态标记，确保只有数据加载后才标记为有更改
     - 将依赖数组修改为 `[params.id, setOverride]`
  
  4. **添加未保存更改提醒**：
     - 实现 `hasUnsavedChanges` 状态跟踪修改
     - 添加 `beforeunload` 事件监听，页面关闭时提醒
     - 创建自定义导航拦截器 `handleNavigation`
     - 提供未保存更改确认对话框，支持：
       - 保存并离开
       - 放弃更改
       - 取消导航

- **新增功能组件**：
  - **工具栏内容** (`renderToolsPanel`)：
    - 快速操作：添加题目、保存评估、返回列表
    - 评估信息：名称、题目数量、题目类型
    - 状态提示：未保存更改警告
  - **保存功能** (`handleSaveAssessment`)：
    - 异步保存评估数据
    - 更新 `hasUnsavedChanges` 状态
    - 显示成功/错误提示
  - **导航拦截**：
    - `handleNavigation` - 检查未保存更改
    - `handleDiscardChanges` - 确认放弃更改
    - `handleCancelNavigation` - 取消导航

- **技术改进**：
  - 使用 `useCallback` 优化性能
  - 状态管理更加合理，避免不必要的重渲染
  - 添加完整的 TypeScript 类型支持
  - 增强用户体验，防止意外丢失数据

- **文件修改**：
  - `ui/src/pages/EditAssessments.tsx` - 主要功能实现
  - `ui/src/index.css` - CSS 类隐藏规则

- **影响范围**：编辑测试页面用户体验大幅提升，解决了工具栏空白、无限刷新、数据丢失等关键问题

### 2025-08-23: 编辑测试页面功能修复

- **功能描述**：修复了编辑测试页面按钮无响应、UI闪烁和操作失效的问题
- **问题分析**：原问题包括：
  1. 添加题目、增加选项等按钮点击后闪烁无效果
  2. 缺少"添加题目"的触发按钮
  3. 状态更新时机导致的UI不同步
  4. 删除选项时正确答案索引未正确更新
- **修改位置**：
  - `ui/src/pages/EditAssessments.tsx` - 修复状态更新逻辑，添加"添加题目"按钮
  - `ui/src/components/QAView.tsx` - 修复选项操作逻辑和正确答案索引更新
- **修复内容**：
  - **状态更新时机优化**：使用 `setTimeout` 确保状态更新完成后再设置 `activeStepIndex`
  - **添加功能按钮**：在 Wizard 顶部添加了"添加题目"按钮，使用 `SpaceBetween` 布局
  - **选项操作限制**：判断题禁止添加新选项（固定两个选项：正确/错误）
  - **删除逻辑优化**：选项少于3个时禁止删除，防止破坏题目结构
  - **正确答案同步**：删除选项时正确更新多选题和单选题的正确答案索引
- **技术细节**：
  ```typescript
  // 修复后的状态更新逻辑
  const wrappedUpdateAssessment = (action) => {
    updateAssessment(action);
    if (action.type === ActionTypes.Add) {
      setTimeout(() => {
        setActiveStepIndex(getQuestions().length - 1);
      }, 0);
    }
  };
  
  // 选项删除时的正确答案更新
  if (isMultiChoice) {
    const newCorrectAnswers = correctAnswers
      .filter(ans => (ans as number) !== (answerIndex + 1))
      .map(ans => (ans as number) > (answerIndex + 1) ? (ans as number) - 1 : ans);
  }
  ```
- **支持的操作**：
  - ✅ 添加新题目（四种类型：单选、多选、判断、简答）
  - ✅ 删除题目
  - ✅ 编辑题目内容
  - ✅ 添加/删除选项（除判断题）
  - ✅ 设置正确答案
  - ✅ 编辑答案解释
- **部署状态**：✅ 已完成修复，前端构建成功
- **已知问题与限制**：
  - 判断题固定为两个选项（正确/错误），不可添加选项
  - 所有题型最少保持2个选项，防止意外删除
- **未来扩展**：
  - 考虑添加题目重排序功能
  - 添加批量操作功能
  - 优化用户体验（如确认删除对话框）

### 2025-08-22: Bedrock知识库权限修复

- **功能描述**：修复了Lambda函数访问Bedrock知识库时的权限不足错误(AccessDeniedException)
- **问题分析**：Lambda函数的执行角色 AssessmentLambdaRole 缺少 `bedrock:Retrieve` 等知识库操作权限，导致无法访问知识库进行文档检索
- **修改位置**：
  - `lib/data-stack.ts` - 更新了 assessmentLambdaRole 的Bedrock权限配置
- **修复内容**：
  - 为评估生成相关的Lambda函数添加了完整的Bedrock知识库权限
  - 新增权限包括：知识库管理、数据摄取、内容检索和生成、Agent相关操作
  - 确保Lambda函数能够正常访问知识库进行RAG(检索增强生成)操作
- **技术细节**：
  - 添加了以下关键权限：
    - `bedrock:Retrieve` - 知识库文档检索
    - `bedrock:RetrieveAndGenerate` - 检索增强生成
    - `bedrock:GetKnowledgeBase` - 获取知识库信息
    - `bedrock:StartIngestionJob` 等数据摄取权限
  - 权限资源设置为 `*` 以支持所有区域的知识库访问
- **部署状态**：✅ 需要重新部署以应用权限更改
- **已知问题与限制**：无
- **未来扩展**：可考虑基于具体知识库ARN进行更精确的权限控制

### 2025-08-22: OpenSearch Serverless权限问题修复

- **功能描述**：修复了知识库创建失败的OpenSearch Serverless 403权限错误
- **问题分析**：CloudWatch日志显示Lambda函数尝试访问OpenSearch Serverless集合时遇到403权限错误，而不是初始报告的"响应为空"
- **修改位置**：
  - `lib/rag-pipeline/rag-pipeline-stack.ts` - 更新OpenSearch数据访问策略权限
- **修复内容**：
  - 从OpenSearch Serverless数据访问策略的collection级别移除了无效的`aoss:APIAccessAll`权限
  - 保持IAM策略中的`aoss:APIAccessAll`和`aoss:DashboardAccessAll`权限不变
  - 确保数据访问策略只包含collection级别支持的权限：CreateCollectionItems、DeleteCollectionItems、UpdateCollectionItems、DescribeCollectionItems
- **技术细节**：
  - 根据AWS文档，`aoss:APIAccessAll`权限只能在IAM策略中使用，不能在OpenSearch Serverless数据访问策略中使用
  - Lambda角色已在IAM策略中正确配置了`aoss:APIAccessAll`和`aoss:DashboardAccessAll`权限
  - 数据访问策略现在符合AWS OpenSearch Serverless的权限规范
- **部署状态**：✅ 已成功部署，CDK堆栈更新完成
- **已知问题与限制**：需要测试知识库创建功能以确认修复生效
- **未来扩展**：考虑实施更细粒度的权限控制以提高安全性

### 2025-08-22: 知识库管理路由删除
- **功能描述**：删除了知识库管理的独立路由，知识库功能现在整合到课程管理中
- **修改位置**：
  - `ui/src/routes.tsx` - 删除了所有用户角色的 `manage-knowledge-bases` 路由
- **修复内容**：
  - 移除了teachers、admin、super_admin角色的独立知识库管理页面路由
  - 知识库管理现在通过课程页面的"管理知识库"按钮访问
- **技术细节**：
  - 从`managementRoutes`数组中移除了knowledge-bases相关路由配置
  - 保持了原有的课程管理和其他管理功能的路由结构
- **已知问题与限制**：无
- **未来扩展**：无

### 2025-08-22: 知识库创建问题修复
- **功能描述**：删除了知识库管理的独立路由，知识库功能现在整合到课程管理中；修复了创建知识库时"响应为空"的错误
- **修改位置**：
  - `ui/src/routes.tsx` - 删除了所有用户角色的 `manage-knowledge-bases` 路由
  - `lib/rag-pipeline/lambdas/event-handler/index.ts` - 修复了Lambda返回值格式，确保符合GraphQL schema
- **修复内容**：
  - 移除了独立的知识库管理页面路由，知识库管理现在通过课程页面的"管理知识库"按钮访问
  - 修复了Lambda函数返回格式，确保返回的对象包含GraphQL schema要求的所有字段
  - 添加了详细的日志记录和错误验证
- **技术细节**：
  - Lambda函数现在返回标准化的IngestionJob对象：`{ingestionJobId, knowledgeBaseId, dataSourceId, status}`
  - 文件路径处理保持一致：前端使用`KnowledgeBases/shared/${courseId}/`，后端正确转换为`shared/${courseId}/`
- **已知问题与限制**：无
- **未来扩展**：考虑添加批量知识库操作功能

---

### 2025-08-22: DynamoDB数据格式转换修复

- **问题描述**：学生测试页面报错"TypeError: Cannot read properties of undefined (reading 'answerChoices')"，原因是DynamoDB返回的原始数据格式未被正确转换

- **修改位置**：
  - `lib/resolvers/getAssessment.ts` - 添加DynamoDB数据格式转换和清理逻辑
  - `lib/resolvers/getStudentAssessment.ts` - 添加数据转换，特别处理assessment属性
  - `lib/resolvers/listAssessments.ts` - 更新数据转换逻辑
  - `ui/src/pages/StudentAssessment.tsx` - 移除前端数据转换逻辑，修复类型导入

- **技术实现**：
  - **数据转换**：在AppSync解析器中处理DynamoDB格式（S、N、L、M等）
  - **数据清理**：处理异常数组格式的correctAnswer、title等字段
  - **错误处理**：确保answerChoices正确从{L: [{S: "..."}]}转换为string[]
  - **类型安全**：修复StudentAssessment类型导入冲突

- **解决的问题**：
  - ✅ 学生测试页面answerChoices undefined错误
  - ✅ 教师编辑评估页面可能遇到的同样数据格式问题
  - ✅ DynamoDB原始格式数据在前端显示异常

- **数据处理逻辑**：
  - 🔄 DynamoDB格式转换：{S: "value"} → "value"，{N: "1"} → 1
  - 🧹 数组字段清理：将错误的数组格式字段合并或重置
  - 📋 answerChoices处理：{L: [{S: "选项1"}, {S: "选项2"}]} → ["选项1", "选项2"]
  - 🎯 correctAnswer处理：{N: "1"} → 1 或 {S: "正确"} → "正确"

- **修复范围**：
  - 🎓 学生测试页面（StudentAssessment.tsx）
  - ✏️ 教师编辑评估页面（EditAssessments.tsx）
  - 📊 评估列表页面（FindAssessments.tsx）
  - 🔍 所有使用GraphQL查询评估数据的组件

- **依赖关系**：AppSync解析器、DynamoDB数据存储、GraphQL API
- **版本控制**：v1.8.2 - DynamoDB数据格式转换修复版本

### 2025-08-22: Assessment时间字段精确化改进

- **功能描述**：将Assessment的时间字段从AWSDate改为AWSDateTime，支持精确到小时分钟的时间选择，提升时间管理精度

- **修改位置**：
  - `lib/schema.graphql` - Assessment和GenerateAssessmentInput类型中lectureDate和deadline字段
  - `ui/src/pages/FindAssessments.tsx` - 日期显示格式更新为toLocaleString
  - `ui/src/pages/StudentAssessments.tsx` - deadline显示格式优化
  - `ui/src/pages/GenerateAssessments.tsx` - 添加时间选择器，更新提交逻辑
  - `migrate-assessment-datetime.js` - 数据迁移脚本

- **技术实现**：
  - **Schema更新**：lectureDate和deadline字段类型从AWSDate改为AWSDateTime
  - **UI改进**：在GenerateAssessments页面添加TimeInput组件，支持时分选择
  - **数据格式化**：日期时间组合为ISO格式（YYYY-MM-DDTHH:mm:00.000Z）
  - **显示优化**：使用toLocaleString('zh-CN')显示本地化时间格式
  - **数据迁移**：提供脚本将现有日期数据转换为datetime格式

- **解决的问题**：
  - ✅ Assessment时间字段只能精确到日期，无法设置具体时间
  - ✅ 前端显示时间信息不够详细，影响时间管理
  - ✅ 用户无法设置精确的上课时间和截止时间

- **用户体验改进**：
  - 🕐 支持设置精确的上课时间（默认09:00）
  - ⏰ 支持设置精确的截止时间（默认23:59）
  - 📅 日期和时间分离输入，操作更直观
  - 🇨🇳 本地化时间显示，符合中文用户习惯

- **数据迁移说明**：
  - 📋 现有数据会自动添加默认时间（上课时间09:00，截止时间23:59）
  - 🔄 迁移脚本确保数据向后兼容
  - ⚠️ 部署前需要运行数据迁移脚本

- **依赖关系**：CloudScape TimeInput组件, GraphQL Assessment类型, 时间处理工具
- **版本控制**：v1.8.1 - Assessment时间字段精确化版本

### 2025-08-22: 用户管理界面优化和数据库字段修改流程规范

- **功能描述**：解决用户管理页面的搜索筛选、角色过滤功能缺失，修复学生分组功能的require错误，优化加载体验，并规范数据库字段修改流程

- **修改位置**：
  - `ui/src/pages/UserManagement.tsx` - 添加搜索筛选框和角色过滤器，优化加载状态
  - `ui/src/pages/StudentList.tsx` - 修复require语法错误，优化加载体验
  - `.github/instructions/copilot-instructions.instructions.md` - 添加数据库字段修改完整流程规范

- **技术实现**：
  - **搜索功能增强**：添加用户名、姓名、邮箱的全文搜索功能
  - **角色过滤器**：支持按学生、教师、管理员、超级管理员角色筛选
  - **加载优化**：初始状态设为loading=true，后续操作使用showLoadingState参数控制，避免界面跳动
  - **ES6模块修复**：将`require('../graphql/mutations').updateStudentGroup`改为正确的import语法
  - **权限控制保持**：角色过滤选项根据当前用户权限动态显示

- **解决的问题**：
  - ✅ 用户管理页面缺少搜索和筛选功能
  - ✅ 学生分组功能报错：`ReferenceError: require is not defined`
  - ✅ 页面加载时的跳动问题，影响用户体验
  - ✅ 缺少数据库字段修改的标准化流程指导

- **用户体验改进**：
  - 🔍 支持按姓名、用户名、邮箱搜索用户
  - 🏷️ 支持按角色快速筛选用户列表
  - 📊 实时显示筛选结果统计（x/总数）
  - 🚀 减少界面跳动，提供流畅的加载体验
  - 🔄 支持一键清除筛选条件

- **开发流程规范**：
  - 📋 新增8步骤数据库字段修改标准流程
  - 🛠️ 包含GraphQL Schema、Resolver、Lambda、前端等全链路更新指导
  - 📚 提供常见字段修改场景示例
  - ✅ 强调测试验证和文档同步的重要性

- **依赖关系**：updateStudentGroup mutation, 用户权限系统, CloudScape Design组件
- **版本控制**：v1.8.0 - 用户界面优化和开发流程规范版本

### 2025-08-21: 学生系统核心功能修复

- **功能描述**：修复学生管理和评估系统的核心问题，确保学生能够正常创建、显示并参与评估

- **修改位置**：
  - `lib/schema.graphql` - 添加 `listPublishedAssessments` 查询
  - `lib/resolvers/listStudents.ts` - 新建学生列表resolver，调用userManagement Lambda
  - `lib/resolvers/listPublishedAssessments.ts` - 新建已发布评估查询resolver
  - `lib/data-stack.ts` - 修复 `listStudents` resolver配置，指向正确的Lambda数据源
  - `lib/lambdas/userManagement.ts` - 添加 `listStudents` 功能和角色映射修复
  - `ui/src/graphql/queries.ts` - 添加 `listPublishedAssessments` 查询
  - `ui/src/pages/StudentAssessments.tsx` - 重写为双标签页显示模式

- **技术实现**：
  - **学生列表修复**：将 `listStudents` resolver 从直接DynamoDB扫描改为调用userManagement Lambda
  - **评估可见性**：新增 `listPublishedAssessments` 查询，学生可以看到所有已发布但未参加的评估
  - **角色映射统一**：修复 `'student'` vs `'students'` 的不一致问题，统一使用 `UserRole.students`
  - **学生界面重设计**：StudentAssessments页面现在显示两个标签页：
    - "可参加的评估"：显示已发布但未参加的评估，可直接开始
    - "已参加的评估"：显示已完成或进行中的评估，可查看结果或继续
  - **评估状态管理**：智能过滤已参加的评估，避免重复显示

- **解决的问题**：
  - ✅ 新创建的学生不在用户管理表格中显示
  - ✅ 新创建的学生不在学生列表中显示
  - ✅ 学生无法在StudentAssessments页面看到已发布的测试
  - ✅ 批量用户创建中的角色映射问题
  - ✅ 学生界面缺少开始新评估的入口

- **用户体验改进**：
  - 👥 学生创建后立即在所有相关列表中可见
  - 📝 学生可以清楚地看到可参加的评估和已完成的评估
  - 🚀 一键开始新评估功能
  - 📊 已完成评估的结果查看和复习功能
  - 🔄 实时更新评估状态，避免数据不同步

- **依赖关系**：listStudents query, listPublishedAssessments query, upsertStudentAssessment mutation
- **版本控制**：v1.7.0 - 学生系统核心功能修复版本

### 2025-08-21: Excel预览功能GraphQL错误修复

- **功能描述**：修复用户管理页面Excel预览功能的GraphQL `previewExcelImport` 字段未定义错误

- **修改位置**：
  - `lib/schema.graphql` - 将 `previewExcelImport` 从 Mutation 移动到 Query 类型
  - `lib/data-stack.ts` - 添加 `QueryPreviewExcelImportResolver` 的AppSync resolver配置
  - `lib/resolvers/previewExcelImport.ts` - 重写为标准AppSync resolver格式，转发请求到Lambda函数
  - `lib/lambdas/userManagement.ts` - 在Lambda函数中添加Excel预览处理逻辑
  - `ui/src/graphql/queries.ts` - 修复GraphQL查询中的字段名称不匹配问题

- **技术实现**：
  - **GraphQL架构修复**：将 `previewExcelImport` 从 Mutation 正确移动到 Query，因为预览操作不修改数据
  - **Resolver标准化**：将复杂的Lambda处理逻辑从resolver文件移动到用户管理Lambda函数中
  - **字段名称统一**：修复前端查询中使用 `preview` 但schema定义为 `previewData` 的不一致性
  - **权限控制保持**：在Lambda函数中保持管理员权限检查逻辑
  - **错误处理增强**：改进CSV解析和数据验证的错误提示

- **解决的问题**：
  - ✅ GraphQL错误："Field 'previewExcelImport' in type 'Query' is undefined"
  - ✅ AppSync resolver格式不符合标准，混合了resolver和Lambda逻辑
  - ✅ 前端GraphQL查询字段名称与schema定义不匹配
  - ✅ Excel预览功能无法正常工作

- **用户体验改进**：
  - 📤 Excel批量导入预览功能恢复正常工作
  - 🔍 支持CSV格式的用户数据预览和验证
  - ⚠️ 详细的数据验证错误提示
  - 🔒 保持权限控制，只有管理员可以使用批量导入功能

- **版本控制**：v1.6.2 - Excel预览功能修复版本

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

#### 功能名称：管理员评估权限管理
- **功能描述**：管理员可以查看和管理所有用户创建的评估，而普通用户只能查看自己的评估
- **核心功能**：
  - **权限区分**：
    - 普通用户使用 `listAssessments` 查询，只返回用户自己创建的评估
    - 管理员使用 `listAllAssessments` 查询，返回所有用户的评估
    - 管理员界面显示创建者信息列
  - **安全控制**：
    - `listAllAssessments` resolver 验证用户组权限
    - 只有 admin 和 super_admin 组可以访问
    - 前端根据权限动态选择查询类型
- **技术实现**：
  - **GraphQL Schema 更新** (`lib/schema.graphql`)：
    - Query 类型新增 `listAllAssessments: [Assessment]`
    - Assessment 类型新增 `userId: String` 字段用于显示创建者
  - **新增 Resolver** (`lib/resolvers/listAllAssessments.ts`)：
    - 权限验证：检查用户组是否包含 admin 或 super_admin
    - 无过滤器的 DynamoDB Scan 操作，返回所有评估
    - 错误处理和权限拒绝响应
  - **前端更新** (`ui/src/pages/FindAssessments.tsx`)：
    - 根据 `adminInfo?.isAdmin` 动态选择查询
    - 管理员视图增加"创建者"列显示 userId 或 createdBy
    - 页面标题显示管理员视图指示器
    - 响应式列显示配置
- **用户体验**：
  - 管理员界面明确标识为"管理员视图"
  - 创建者信息列帮助管理员识别评估归属
  - 无缝的权限切换，自动选择适当的查询
- **权限逻辑**：
  - **普通用户**：只能看到和管理自己创建的评估
  - **管理员**：可以查看所有评估，具有完整管理权限
  - **数据过滤**：后端 resolver 级别的权限控制
- **输入**：用户身份认证信息
- **输出**：根据权限过滤的评估列表
- **代码位置**：
  - `lib/resolvers/listAllAssessments.ts` - 管理员评估查询
  - `ui/src/pages/FindAssessments.tsx` - 前端权限适配
  - `ui/src/graphql/queries.ts` - GraphQL 查询定义
- **使用示例**：
  ```typescript
  // 根据管理员权限选择查询
  const query = adminInfo?.isAdmin ? listAllAssessments : listAssessments;
  const queryName = adminInfo?.isAdmin ? 'listAllAssessments' : 'listAssessments';
  
  const { data } = await client.graphql({ query });
  const assessments = data[queryName];
  ```
- **依赖关系**：用户认证、权限管理、GraphQL API
- **安全性**：后端权限验证，防止权限绕过
- **版本控制**：v1.2.0 - 管理员功能增强
- **未来扩展**：按用户筛选、评估转移功能、批量管理操作

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

## DynamoDB 表结构信息

### 表列表概览

项目使用以下DynamoDB表来存储各类数据，所有表都配置为按需计费模式：

#### 核心业务表

1. **AssessmentsTable** - 评估数据表
   - **表名**: `GenAssessStack-DataStackNestedStackDataStackNestedStackResource8D986F6F-WZN8STT9JLUJ-AssessmentsTable6996196E-1JTSUQZSJTVXK`
   - **主键**: `userId (S)` + `id (S)` (复合主键)
   - **GSI**: `id-only` (以id为分区键的全局二级索引)
   - **大小**: 40.8KB
   - **用途**: 存储教师创建的评估信息，包括名称、课程ID、上课时间、截止时间等

2. **StudentAssessmentsTable** - 学生评估关联表
   - **表名**: `GenAssessStack-DataStackNestedStackDataStackNestedStackResource8D986F6F-WZN8STT9JLUJ-StudentAssessmentsTable660FD085-1V5I0AC5JOLYG`
   - **主键**: `userId (S)` + `parentAssessId (S)` (复合主键)
   - **大小**: 1.9KB
   - **用途**: 存储学生参与评估的记录，包括答案、分数、提交状态等

3. **UsersTable** - 用户基础信息表
   - **表名**: `GenAssessStack-DataStackNestedStackDataStackNestedStackResource8D986F6F-WZN8STT9JLUJ-UsersTable9725E9C8-FMTN6J8BOV51`
   - **主键**: `id (S)` (单主键)
   - **大小**: 6.7KB
   - **用途**: 存储用户基础信息，如姓名、邮箱、角色等

4. **CoursesTable** - 课程信息表
   - **表名**: `GenAssessStack-DataStackNestedStackDataStackNestedStackResource8D986F6F-WZN8STT9JLUJ-CoursesTable3F79D98E-EE7ZIUBKYN6Z`
   - **主键**: `id (S)` (单主键)
   - **大小**: 541 字节
   - **用途**: 存储课程信息，包括课程名称、描述等

#### 模板和分组表

5. **AssessTemplatesTable** - 评估模板表
   - **表名**: `GenAssessStack-DataStackNestedStackDataStackNestedStackResource8D986F6F-WZN8STT9JLUJ-AssessTemplatesTableA1C1DEB9-5THS1TWF00HX`
   - **主键**: `userId (S)` + `id (S)` (复合主键)
   - **大小**: 510 字节
   - **用途**: 存储评估模板配置，包括题目类型分布、难度设置等

6. **StudentGroupsTable** - 学生分组表
   - **表名**: `GenAssessStack-DataStackNestedStackDataStackNestedStackResource8D986F6F-WZN8STT9JLUJ-StudentGroupsTable6E685D02-RZJZNDKZ5ZGS`
   - **主键**: `id (S)` (单主键)
   - **大小**: 142 字节
   - **用途**: 存储学生分组信息，用于批量管理学生

7. **StudentsTable** - 学生详细信息表
   - **表名**: `GenAssessStack-DataStackNestedStackDataStackNestedStackResource8D986F6F-WZN8STT9JLUJ-StudentsTableDAB56938-UCCNGIGN4KAU`
   - **主键**: `id (S)` (单主键)
   - **大小**: 0 字节 (当前为空)
   - **用途**: 存储学生特定信息和扩展属性

#### 系统配置和知识库表

8. **SettingsTable** - 系统设置表
   - **表名**: `GenAssessStack-DataStackNestedStackDataStackNestedStackResource8D986F6F-WZN8STT9JLUJ-SettingsTable4DB0CCD0-1DEL1UGBAVD31`
   - **主键**: `userId (S)` (单主键)
   - **大小**: 102.9KB
   - **用途**: 存储用户个性化设置和系统配置信息

9. **KBTable** - 知识库表
   - **表名**: `GenAssessStack-RagStackNestedStackRagStackNestedStackResourceE632B76F-1XR4FTEXQQVSG-KBTable3C212AC0-W6SXBVRR4MSM`
   - **主键**: `userId (S)` + `courseId (S)` (复合主键)
   - **大小**: 2KB
   - **用途**: 存储知识库元数据，关联RAG检索系统

#### 日志和监控表

10. **LogAnalyticsTable** - 日志分析表
    - **表名**: `GenAssessStack-LoggingStackNestedStackLoggingStackNestedStackResourceA0D8489D-1W2TYG83CSNAI-LogAnalyticsTable7C30A423-VNSBFMMHPC0B`
    - **主键**: `logId (S)` + `timestamp (S)` (复合主键)
    - **大小**: 0 字节
    - **用途**: 存储系统操作日志，用于审计和分析

11. **SystemMetricsTable** - 系统指标表
    - **表名**: `GenAssessStack-LoggingStackNestedStackLoggingStackNestedStackResourceA0D8489D-1W2TYG83CSNAI-SystemMetricsTable572C1AA7-1N6ENVCZSQ8PH`
    - **主键**: `metricKey (S)` + `timestamp (S)` (复合主键)
    - **大小**: 0 字节
    - **用途**: 存储系统性能指标和监控数据

### 表架构设计说明

#### 主键设计模式
- **复合主键**: 大部分表使用 `userId + 其他键` 的模式，确保数据按用户隔离
- **单主键**: 公共数据表（如课程、设置）使用单一的 `id` 作为主键
- **时间序列**: 日志类表使用 `键 + timestamp` 模式，便于时间范围查询

#### 数据访问模式
- **用户数据隔离**: 通过 `userId` 作为分区键，确保用户数据安全隔离
- **高效查询**: 设计GSI支持按ID直接查询，避免全表扫描
- **按需扩展**: 所有表均配置按需计费，根据实际使用量自动扩缩容

### 使用注意事项

1. **表名获取**: 实际表名由CDK自动生成，包含堆栈信息，需要从AWS控制台或CDK输出获取
2. **主键构造**: 进行CRUD操作时必须提供完整的主键信息
3. **权限控制**: 确保Lambda函数有相应表的读写权限
4. **迁移操作**: 修改表结构时需要考虑现有数据的兼容性

---

此文档提供了项目所有已实现功能的详细说明，包括技术实现、使用方式、依赖关系和改进建议。建议定期更新此文档以反映项目的最新状态。
