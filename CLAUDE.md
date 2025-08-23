# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 语言使用指导 / Language Usage Guidelines

**重要：在此代码库中工作时，请遵循以下语言使用规则：**

### 中文优先原则
- **回答和交流**：与用户交流时请优先使用中文回答
- **思考过程**：在thinking模式下请使用中文进行思考和分析
- **文档创建**：创建新的Markdown文件或文档时，请使用中文进行注释和说明
- **错误信息**：在可能的情况下，提供中文的错误解释和解决方案

### 代码注释规范
- 为新添加的代码函数添加中文注释
- 复杂业务逻辑请用中文解释
- README文件和技术文档的更新请包含中文说明

### 双语支持
- 重要的技术术语可以保持英文，但需要提供中文解释
- 与AWS服务相关的配置和部署说明可以英中对照
- GraphQL schema和API文档保持英文，但业务逻辑说明用中文

## Project Overview

Assessment Generator is a comprehensive AWS-based application for creating and managing intelligent assessment questions from reference materials. The system supports multiple question types (multiple choice, true/false, single choice, free text) and includes features for course management, student groups, assessment templates, and comprehensive logging.

## Architecture

The application follows a multi-stack AWS CDK architecture:

### Backend Infrastructure (AWS CDK)
- **Main Stack** (`lib/gen-assess-stack.ts`): Orchestrates all nested stacks
- **Auth Stack** (`lib/auth-stack.ts`): Cognito user pools and identity management
- **Data Stack** (`lib/data-stack.ts`): AppSync GraphQL API, DynamoDB tables, Lambda resolvers
- **Frontend Stack** (`lib/frontend-stack.ts`): CloudFront distribution and S3 hosting
- **RAG Pipeline Stack** (`lib/rag-pipeline/rag-pipeline-stack.ts`): Knowledge base ingestion and processing
- **Logging Stack** (`lib/logging-stack.ts`): Comprehensive system monitoring and log management

### Frontend Application (React + Vite)
- **Location**: `ui/` directory
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Components**: Cloudscape Design System, Mantine
- **Authentication**: AWS Amplify with Cognito
- **State Management**: React Context API
- **Routing**: React Router v6

## Key Development Commands

### Backend (AWS CDK)
```bash
# Install dependencies
npm ci

# Build TypeScript
npm run build

# Run tests
npm test

# Deploy standard stack
npx cdk bootstrap --qualifier gen-assess
npm run cdk deploy


### Frontend (UI)
```bash
# Navigate to UI directory
cd ui

# Install dependencies
npm ci

# Development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

## GraphQL Schema

The API schema is defined in `lib/schema.graphql` and includes:

### Core Entities
- **Course**: Course management with metadata
- **Assessment**: Generated assessments with multiple question types
- **AssessTemplate**: Reusable assessment templates with difficulty distribution
- **Student/StudentGroup**: User management and grouping
- **KnowledgeBase**: Document ingestion and RAG pipeline integration

### Key Features
- Multi-language support (English/Chinese)
- Comprehensive logging and monitoring system
- Admin permission management
- Real-time system health metrics
- Assessment publishing and student assignment

## Important File Locations

### Backend Core Files
- `lib/schema.graphql`: GraphQL API schema
- `lib/resolvers/`: Lambda resolvers for GraphQL operations
- `lib/lambdas/`: Core business logic Lambda functions
- `lib/config/adminConfig.ts`: Admin permission configuration

### Frontend Core Files
- `ui/src/App.tsx`: Main application component with authentication
- `ui/src/routes.tsx`: Route definitions for teachers/students
- `ui/src/contexts/`: React context providers (theme, auth, alerts)
- `ui/src/components/`: Reusable UI components
- `ui/src/pages/`: Page components for different features

### Configuration Files
- `cdk.json`: CDK configuration with feature flags
- `tsconfig.json`: TypeScript configuration for backend
- `ui/tsconfig.json`: TypeScript configuration for frontend
- `jest.config.js`: Jest testing configuration

## User Roles and Permissions

The system supports role-based access:
- **Students**: Take assessments, view results
- **Teachers**: Create courses, templates, assessments, manage knowledge bases
- **Admins**: Access log management, system monitoring (configurable levels)

## Development Notes

### TypeScript Configuration
- Backend uses Node.js with ES2022 target
- Frontend uses modern ES2020 with React JSX transform
- Strict typing enabled for frontend, relaxed for backend CDK code

### Testing
- Jest configured for unit testing
- Test files should be placed in `test/` directory
- Run tests with `npm test`

### Deployment
- CDK bootstrap required with custom qualifier: `gen-assess`
- Logging system deployment includes additional CloudWatch resources
- Frontend assets automatically deployed to S3/CloudFront

### Multi-language Support
- UI supports English and Chinese
- Language switching implemented via React context
- Enum translations handled through specialized hooks

### Theme System
- Supports light/dark themes with custom branding
- Theme persistence and admin-configurable logos
- Custom CSS variables for consistent styling

## Common Development Tasks / 常见开发任务

When working on this codebase / 在此代码库中工作时：

1. **Adding new GraphQL operations / 添加新的GraphQL操作**: Update `lib/schema.graphql` and create corresponding resolvers in `lib/resolvers/`
   - 更新GraphQL模式定义
   - 创建对应的Lambda解析器，使用中文注释解释业务逻辑
   - 确保新操作符合现有的GraphQL规范
   - 不需要手动更新`ui\src\graphql\mutations.ts`、`ui\src\graphql\API.ts`和`ui\src\graphql\queries.ts`，只在`lib/schema.graphql`中更新

2. **Creating new UI components / 创建新的UI组件**: Follow the existing pattern in `ui/src/components/` using Cloudscape Design System
   - 遵循现有的组件模式和设计系统
   - 为组件添加中文注释和PropTypes说明

3. **Adding new routes / 添加新路由**: Update `ui/src/routes.tsx` for role-based routing
   - 根据用户角色（学生、教师、管理员）配置路由
   - 在路由配置中添加中文说明

4. **Database operations / 数据库操作**: Use the established DynamoDB patterns in resolver functions
   - 使用现有的DynamoDB操作模式
   - 为数据库查询和更新操作添加中文注释

5. **Adding new Lambda functions / 添加新的Lambda函数**: Place in `lib/lambdas/` and integrate via CDK stacks
   - 将新函数放置在正确的目录结构中
   - 使用中文注释解释函数用途和业务逻辑

6. **Implementing admin features / 实现管理员功能**: Check admin permissions using the established pattern in components
   - 遵循现有的权限检查模式
   - 为管理员功能添加详细的中文文档

7. **Adding logging / 添加日志记录**: Use the existing logging system integration for monitoring new features
   - 使用现有的日志系统集成
   - 日志消息支持中文，便于问题排查

8. **Documentation updates / 文档更新**: When creating or updating documentation
   - 新建的Markdown文件请使用中文编写主要内容
   - 技术配置部分可以英中对照
   - 为重要的配置项提供中文说明