# 管理员权限系统 - 仅后端验证架构

## 概述

基于您的要求，我们已经将管理员权限系统修改为仅使用后端验证的架构。这种设计提供了更好的安全性和一致性。

## 系统架构

### 1. 后端配置 (`lib/config/adminConfig.ts`)
- **ADMIN_EMAILS**: 存储所有管理员邮箱地址的映射
- **ADMIN_PERMISSIONS**: 定义每个邮箱对应的权限级别
- **AdminPermissionLevel**: 枚举类型，定义三个权限级别：
  - `SUPER_ADMIN`: 超级管理员
  - `SYSTEM_ADMIN`: 系统管理员  
  - `LOG_ADMIN`: 日志管理员

### 2. 后端验证工具 (`lib/utils/adminUtils.ts`)
- **isAdminFromContext**: 根据 `ctx.identity.sub` 检查用户是否为管理员
- **getUserRoleInfo**: 获取用户的详细权限信息
- **requireAdminPermission**: GraphQL 解析器中的权限验证中间件

### 3. 前端权限查询 (`ui/src/utils/adminPermissions.ts`)
- **useAdminPermissions**: React Hook，通过 GraphQL 查询用户权限
- **checkUserAdminPermissions**: GraphQL 查询函数
- **getAdminLevelDisplayName**: 获取权限级别的显示名称

### 4. 用户界面集成 (`ui/src/App.tsx`)
- 在用户下拉菜单中显示管理员权限级别
- 只有管理员用户才会显示权限信息
- 支持多语言显示

## 安全优势

✅ **集中管理**: 所有权限配置都在后端
✅ **安全验证**: 前端无法绕过权限检查
✅ **实时验证**: 每次操作都通过后端验证
✅ **数据一致性**: 避免前后端配置不一致的问题

## 配置管理员

要添加新的管理员，只需在 `lib/config/adminConfig.ts` 中添加：

```typescript
export const ADMIN_EMAILS: Record<string, AdminPermissionLevel> = {
  'yibo.yan24@student.xjtlu.edu.cn': AdminPermissionLevel.SUPER_ADMIN,
  'new.admin@example.com': AdminPermissionLevel.SYSTEM_ADMIN,
  // 添加更多管理员...
};
```

## 使用方式

### 在 GraphQL 解析器中验证权限：

```typescript
// 检查是否为管理员
const isAdmin = await isAdminFromContext(context);

// 获取详细权限信息
const roleInfo = await getUserRoleInfo(context);

// 要求特定权限级别
await requireAdminPermission(context, AdminPermissionLevel.SUPER_ADMIN);
```

### 在前端组件中获取权限信息：

```typescript
function MyComponent() {
  const { adminInfo, loading, error } = useAdminPermissions();
  
  if (adminInfo?.isAdmin) {
    return <div>管理员级别: {adminInfo.adminLevel}</div>;
  }
  
  return <div>普通用户</div>;
}
```

## 权限级别说明

- **超级管理员 (SUPER_ADMIN)**: 拥有所有权限，包括系统配置和用户管理
- **系统管理员 (SYSTEM_ADMIN)**: 拥有系统操作权限，但不能修改核心配置
- **日志管理员 (LOG_ADMIN)**: 只能查看和管理系统日志

## 测试验证

运行验证脚本确保系统配置正确：

```bash
node admin_validation_test.js
```

此脚本会检查：
- 后端配置文件是否存在
- 权限验证函数是否正确
- 前端是否已移除不安全的配置
- 语言文件是否包含必要的翻译
- UI 组件是否正确集成

## 注意事项

1. **部署后生效**: 权限配置更改需要重新部署后端才能生效
2. **缓存问题**: 如果使用了缓存，可能需要清除缓存以获取最新权限
3. **日志记录**: 建议在权限验证失败时记录日志用于安全审计
4. **备份配置**: 在修改权限配置前请备份原始配置

---

*此文档记录了管理员权限系统从前后端混合验证到纯后端验证的架构迁移。*
