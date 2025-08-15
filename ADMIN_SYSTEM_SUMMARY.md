# 管理员权限系统实现总结

## 🎯 实现概述

我已经为您的 Assessment Generator 系统成功创建了一个完整的管理员权限管理系统。该系统基于用户邮箱进行身份验证，支持多级权限控制，并提供了前后端完整的权限检查功能。

## 📁 创建的文件

### 后端文件

1. **`lib/config/adminConfig.ts`** - 管理员配置文件
   - 配置管理员邮箱列表
   - 定义权限级别枚举
   - 设置各管理员的权限级别

2. **`lib/utils/adminUtils.ts`** - 管理员权限工具函数
   - `isAdmin()` - 检查用户是否为管理员
   - `getUserRoleInfo()` - 获取用户完整角色信息
   - `requireAdminPermission()` - 权限检查装饰器
   - `canAccessLogManagement()` - 日志管理权限检查

3. **`lib/resolvers/checkAdminPermissions.ts`** - 权限查询 resolver
   - 提供 GraphQL 查询接口
   - 返回用户的完整权限信息

4. **`lib/resolvers/queryLogsWithAdminCheck.ts`** - 日志查询权限检查
   - 演示如何在关键功能中集成权限检查

### 前端文件

5. **`ui/src/utils/adminPermissions.ts`** - 前端权限工具
   - React Hook `useAdminPermissions()`
   - 权限检查函数
   - 快速邮箱验证

6. **`ui/src/components/AdminPanel.tsx`** - 管理员面板组件示例
   - 完整的权限检查示例
   - HOC 权限保护组件

### 测试和文档

7. **`test/adminPermissionTest.ts`** - 权限系统测试脚本
8. **`ADMIN_PERMISSIONS_GUIDE.md`** - 详细使用指南

### 更新的文件

9. **`lib/schema.graphql`** - 添加了管理员权限查询
10. **`lib/resolvers/listAssessTemplates.ts`** - 更新为支持管理员查看所有模板

## 🔧 主要功能

### 1. 管理员权限级别
- **SUPER_ADMIN**: 超级管理员，拥有所有权限
- **SYSTEM_ADMIN**: 系统管理员，拥有系统管理权限
- **LOG_ADMIN**: 日志管理员，仅能访问日志功能

### 2. 权限检查方式
- **邮箱匹配**: 基于预配置的管理员邮箱列表
- **上下文验证**: 通过 `ctx.identity.sub` 获取用户身份
- **多级权限**: 支持不同功能需要不同权限级别

### 3. 前后端集成
- **后端保护**: GraphQL resolver 级别的权限检查
- **前端验证**: React Hook 和组件级别的权限控制
- **双重验证**: 前端用于UI优化，后端进行实际权限验证

## 🚀 使用步骤

### 1. 配置管理员邮箱

编辑 `lib/config/adminConfig.ts`:

```typescript
export const ADMIN_EMAILS: string[] = [
  'your-admin-email@company.com',    // 替换为您的管理员邮箱
  // 添加其他管理员邮箱
];

export const ADMIN_PERMISSIONS: Record<string, AdminPermissionLevel> = {
  'your-admin-email@company.com': AdminPermissionLevel.SUPER_ADMIN,
};
```

### 2. 同步前端配置

编辑 `ui/src/utils/adminPermissions.ts`:

```typescript
const ADMIN_EMAILS: string[] = [
  'your-admin-email@company.com',    // 与后端保持一致
];
```

### 3. 在后端使用权限检查

```typescript
import { isAdminFromContext, requireAdminPermission } from '../utils/adminUtils';

export function request(ctx) {
  // 简单权限检查
  if (!isAdminFromContext(ctx)) {
    util.error('需要管理员权限', 'Forbidden');
  }
  
  // 或要求特定权限级别
  requireAdminPermission(ctx, AdminPermissionLevel.SYSTEM_ADMIN);
  
  // 继续处理...
}
```

### 4. 在前端使用权限检查

```typescript
import { useAdminPermissions } from '../utils/adminPermissions';

function MyComponent() {
  const { adminInfo, loading } = useAdminPermissions();

  if (!adminInfo?.isAdmin) {
    return <div>需要管理员权限</div>;
  }

  return <div>管理员功能...</div>;
}
```

## 🔍 根据 ctx.identity.sub 检验管理员的函数

### 主要检验函数

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

## 🔒 安全特性

1. **双重验证**: 前端检查 + 后端验证
2. **权限审计**: 记录管理员操作日志
3. **最小权限原则**: 不同功能要求不同权限级别
4. **邮箱验证**: 基于可信的邮箱地址进行身份验证

## 📋 部署检查清单

1. ✅ 配置管理员邮箱 (`lib/config/adminConfig.ts`)
2. ✅ 同步前端配置 (`ui/src/utils/adminPermissions.ts`)
3. ✅ 更新 GraphQL schema
4. ✅ 运行测试脚本验证配置
5. ⚠️ 使用管理员邮箱注册账户并测试
6. ⚠️ 验证普通用户无法访问管理员功能
7. ⚠️ 测试日志管理功能的权限控制

## 🎯 特色功能

1. **智能权限继承**: 高级权限自动包含低级权限
2. **灵活配置**: 支持为不同管理员分配不同权限级别
3. **React 集成**: 提供 Hook 和 HOC 组件
4. **TypeScript 支持**: 完整的类型定义
5. **错误处理**: 友好的错误提示和状态处理

## 🔧 未来扩展

1. **环境变量配置**: 将管理员列表移至环境变量
2. **数据库存储**: 权限配置存储到数据库
3. **批量管理**: 支持批量添加/删除管理员
4. **审计日志**: 详细的管理员操作记录
5. **权限委托**: 支持临时权限委托

---

## 💡 快速验证

运行测试脚本来验证配置：

```bash
# 在项目根目录运行
npm run test:admin-permissions
```

或者直接在浏览器控制台运行权限检查：

```javascript
// 检查当前用户权限
import { checkUserAdminPermissions } from './utils/adminPermissions';
checkUserAdminPermissions().then(console.log);
```

---

**注意**: 请在部署到生产环境前，将示例邮箱地址替换为您的实际管理员邮箱，并进行充分的测试。
