# 管理员权限系统使用指南

本系统实现了一个基于邮箱的管理员权限管理功能，支持多级权限控制。

## 📋 功能概述

### 管理员权限级别
- **SUPER_ADMIN** (超级管理员): 拥有所有系统权限
- **SYSTEM_ADMIN** (系统管理员): 拥有系统管理权限，但不能修改超级管理员设置
- **LOG_ADMIN** (日志管理员): 仅能访问日志管理功能

### 功能特性
- ✅ 基于邮箱的管理员身份验证
- ✅ 多级权限控制
- ✅ 前后端权限验证
- ✅ GraphQL resolver 级别的权限检查
- ✅ React Hook 和工具函数支持

## 🔧 配置管理员

### 1. 后端配置

在 `lib/config/adminConfig.ts` 文件中配置管理员邮箱：

```typescript
export const ADMIN_EMAILS: string[] = [
  'admin@example.com',           // 示例管理员邮箱
  'system.admin@company.com',    // 系统管理员
  'your.email@domain.com',       // 添加您的邮箱
];

export const ADMIN_PERMISSIONS: Record<string, AdminPermissionLevel> = {
  'admin@example.com': AdminPermissionLevel.SUPER_ADMIN,
  'system.admin@company.com': AdminPermissionLevel.SYSTEM_ADMIN,
  'log.viewer@company.com': AdminPermissionLevel.LOG_ADMIN,
};
```

### 2. 前端配置

在 `ui/src/utils/adminPermissions.ts` 文件中同步配置管理员邮箱（用于快速UI反馈）：

```typescript
const ADMIN_EMAILS: string[] = [
  'admin@example.com',
  'system.admin@company.com',
  'your.email@domain.com',
];
```

## 🚀 使用方法

### 后端使用（GraphQL Resolvers）

#### 1. 基础权限检查

```typescript
import { isAdminFromContext, requireAdminPermission, AdminPermissionLevel } from '../utils/adminUtils';

export function request(ctx) {
  // 检查是否为管理员
  if (!isAdminFromContext(ctx)) {
    util.error('需要管理员权限', 'Forbidden');
  }
  
  // 或者要求特定权限级别
  requireAdminPermission(ctx, AdminPermissionLevel.SYSTEM_ADMIN);
  
  // 继续处理请求...
}
```

#### 2. 获取用户角色信息

```typescript
import { getUserRoleInfo } from '../utils/adminUtils';

export function request(ctx) {
  const userInfo = getUserRoleInfo(ctx);
  
  if (userInfo.isAdmin) {
    // 管理员可以看到所有数据
    return { operation: 'Scan' };
  } else {
    // 普通用户只能看到自己的数据
    return {
      operation: 'Query',
      query: {
        expression: 'userId = :userId',
        expressionValues: util.dynamodb.toMapValues({ ':userId': ctx.identity.sub }),
      },
    };
  }
}
```

### 前端使用（React 组件）

#### 1. 使用 React Hook

```typescript
import { useAdminPermissions } from '../utils/adminPermissions';

function MyComponent() {
  const { adminInfo, loading, error } = useAdminPermissions();

  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error}</div>;

  return (
    <div>
      {adminInfo?.isAdmin && (
        <div>
          <h3>管理员功能</h3>
          {adminInfo.permissions.canAccessLogManagement && (
            <button>访问日志管理</button>
          )}
          {adminInfo.permissions.canManageUsers && (
            <button>用户管理</button>
          )}
        </div>
      )}
    </div>
  );
}
```

#### 2. 快速邮箱检查

```typescript
import { isEmailAdmin, isUserPotentialAdmin } from '../utils/adminPermissions';
import { useUserProfile } from '../contexts/userProfile';

function NavigationComponent() {
  const user = useUserProfile();
  
  // 快速检查是否可能是管理员（用于UI快速响应）
  const potentialAdmin = isUserPotentialAdmin(user);
  
  return (
    <nav>
      <a href="/dashboard">仪表盘</a>
      {potentialAdmin && (
        <a href="/admin">管理员面板</a>
      )}
    </nav>
  );
}
```

#### 3. 手动权限检查

```typescript
import { checkUserAdminPermissions } from '../utils/adminPermissions';

async function handleAdminAction() {
  const adminInfo = await checkUserAdminPermissions();
  
  if (!adminInfo?.isAdmin) {
    alert('需要管理员权限');
    return;
  }
  
  if (!adminInfo.permissions.canManageSystem) {
    alert('权限不足');
    return;
  }
  
  // 执行管理员操作
  performAdminAction();
}
```

## 🔒 安全考虑

### 1. 双重验证
- 前端检查仅用于UI优化，不能依赖于客户端验证
- 所有重要操作必须在后端进行权限验证
- GraphQL resolver 中必须包含权限检查

### 2. 权限传递
- 用户身份信息通过 `ctx.identity.sub` 获取
- 邮箱信息从 Cognito 用户属性中获取
- 不要在前端存储敏感的权限信息

### 3. 配置安全
- 管理员邮箱配置应该通过环境变量或安全配置管理
- 避免在代码中硬编码敏感邮箱地址
- 定期审核管理员权限列表

## 📝 实际部署时的配置步骤

### 1. 更新管理员邮箱列表

编辑 `lib/config/adminConfig.ts`：
```typescript
export const ADMIN_EMAILS: string[] = [
  'your-admin-email@company.com',    // 替换为您的管理员邮箱
  // 添加其他管理员邮箱
];
```

### 2. 设置权限级别

```typescript
export const ADMIN_PERMISSIONS: Record<string, AdminPermissionLevel> = {
  'your-admin-email@company.com': AdminPermissionLevel.SUPER_ADMIN,
  // 为其他管理员分配适当的权限级别
};
```

### 3. 同步前端配置

编辑 `ui/src/utils/adminPermissions.ts`：
```typescript
const ADMIN_EMAILS: string[] = [
  'your-admin-email@company.com',    // 与后端保持一致
];
```

### 4. 测试管理员功能

1. 使用管理员邮箱注册/登录账户
2. 检查是否能访问管理员功能
3. 验证权限级别是否正确

## 🔍 检验用户是否为管理员的函数

### 后端检验函数

根据 `ctx.identity.sub` 检验用户是否为管理员：

```typescript
import { isAdminFromContext, getUserRoleInfo } from '../utils/adminUtils';

/**
 * 检验用户是否为管理员的主要函数
 * @param ctx - AppSync 上下文，包含 ctx.identity.sub
 * @returns boolean - 是否为管理员
 */
function checkIfUserIsAdmin(ctx: any): boolean {
  return isAdminFromContext(ctx);
}

/**
 * 获取详细的用户角色信息
 * @param ctx - AppSync 上下文
 * @returns 用户角色信息，包括管理员状态和权限级别
 */
function getUserAdminStatus(ctx: any) {
  return getUserRoleInfo(ctx);
}

// 使用示例
export function request(ctx) {
  const isAdmin = checkIfUserIsAdmin(ctx);
  const userInfo = getUserAdminStatus(ctx);
  
  console.log('用户是否为管理员:', isAdmin);
  console.log('用户详细信息:', userInfo);
  
  if (isAdmin) {
    // 管理员逻辑
  } else {
    // 普通用户逻辑
  }
}
```

### 前端检验函数

```typescript
import { useAdminPermissions, checkUserAdminPermissions } from '../utils/adminPermissions';

/**
 * React Hook 方式检验管理员
 */
function useIsAdmin() {
  const { adminInfo, loading } = useAdminPermissions();
  return { 
    isAdmin: adminInfo?.isAdmin || false, 
    loading,
    adminInfo 
  };
}

/**
 * 异步函数方式检验管理员
 */
async function checkIsAdmin(): Promise<boolean> {
  const adminInfo = await checkUserAdminPermissions();
  return adminInfo?.isAdmin || false;
}
```

## 📚 相关文件

- **后端配置**: `lib/config/adminConfig.ts`
- **后端工具**: `lib/utils/adminUtils.ts`
- **GraphQL Schema**: `lib/schema.graphql` (新增 `checkAdminPermissions` 查询)
- **Resolver 示例**: `lib/resolvers/listAssessTemplates.ts`
- **管理员权限检查**: `lib/resolvers/checkAdminPermissions.ts`
- **前端工具**: `ui/src/utils/adminPermissions.ts`

## 🎯 下一步扩展

1. **环境变量配置**: 将管理员邮箱列表移至环境变量
2. **数据库存储**: 将权限配置存储到数据库中
3. **审计日志**: 记录管理员操作日志
4. **权限缓存**: 实现权限信息缓存机制
5. **批量管理**: 支持批量添加/删除管理员

---

**注意**: 请在实际部署前仔细测试所有管理员功能，确保权限系统正常工作。
