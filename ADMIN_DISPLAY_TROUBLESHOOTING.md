# 管理员身份显示功能故障排除指南

## 问题描述
管理员身份没有在profile下拉框中显示

## 可能的原因和解决方案

### 1. 检查部署状态 ✅
- **状态**: 后端已成功部署
- **确认**: CDK部署完成，所有组件已更新

### 2. 检查管理员配置

#### 后端配置文件: `lib/config/adminConfig.ts`
```typescript
export const ADMIN_EMAILS: string[] = [
  'yibo.yan24@student.xjtlu.edu.cn',  // 已配置
];

export const ADMIN_PERMISSIONS: Record<string, AdminPermissionLevel> = {
  'yibo.yan24@student.xjtlu.edu.cn': AdminPermissionLevel.SUPER_ADMIN,
};
```

#### 前端权限检查: `ui/src/utils/adminPermissions.ts`
- GraphQL查询已定义
- useAdminPermissions Hook已实现

#### UI集成: `ui/src/App.tsx`
- 权限显示逻辑已实现
- 用户下拉菜单已更新

### 3. 浏览器测试步骤

1. **清除浏览器缓存**
   - 按 F12 打开开发者工具
   - 右键刷新按钮，选择"清空缓存并硬性重新加载"

2. **使用正确的管理员邮箱登录**
   - 确保使用 `yibo.yan24@student.xjtlu.edu.cn` 登录

3. **检查控制台输出**
   - 打开浏览器开发者工具（F12）
   - 查看Console面板是否有错误信息

4. **检查网络请求**
   - 在Network面板中查找GraphQL请求
   - 确认 `checkAdminPermissions` 查询是否成功

### 4. 预期的显示效果

#### 登录前
- 用户下拉菜单显示: `教师: [用户名]`

#### 管理员登录后
- 用户下拉菜单显示: `教师: [用户名] (超级管理员)`
- 下拉描述显示: `个人资料: 教师 | 管理员权限: 超级管理员`

### 5. 调试工具

#### 在浏览器控制台运行以下代码检查权限：
```javascript
// 检查管理员权限
import('./utils/adminPermissions.js').then(({ checkUserAdminPermissions }) => {
  checkUserAdminPermissions().then(result => {
    console.log('管理员权限结果:', result);
  });
});
```

### 6. 常见问题

#### 问题1: 控制台显示GraphQL错误
**解决方案**: 
- 确认后端 `checkAdminPermissions` resolver已部署
- 检查GraphQL schema是否包含相关定义

#### 问题2: 权限查询返回null
**解决方案**: 
- 确认登录的邮箱在 `ADMIN_EMAILS` 配置中
- 检查用户的身份认证状态

#### 问题3: UI没有更新
**解决方案**: 
- 清除浏览器缓存
- 检查 `useAdminPermissions` Hook是否正确调用
- 确认前端代码已更新

### 7. 验证步骤

1. **登录系统**: 使用 `yibo.yan24@student.xjtlu.edu.cn`
2. **查看右上角**: 用户下拉菜单应显示管理员标识
3. **访问管理功能**: 检查是否能访问管理员专用功能
4. **查看AdminPermissionTest页面**: 访问该页面查看详细权限信息

### 8. 应用程序URL
https://d1jcpgwv35lp8s.cloudfront.net

### 9. 技术支持

如果问题仍然存在，请：
1. 截取浏览器控制台的错误信息
2. 检查网络面板中的GraphQL请求详情
3. 确认使用的邮箱地址完全匹配配置文件中的地址

## 期望结果
管理员用户登录后，在右上角的用户下拉菜单中应该能看到管理员权限级别显示。
