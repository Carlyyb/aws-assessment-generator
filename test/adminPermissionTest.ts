// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 管理员权限系统测试脚本
 * 用于验证管理员权限配置是否正确
 */

import { isAdmin, getAdminPermissionLevel, hasAdminPermission } from '../lib/utils/adminUtils';
import { ADMIN_EMAILS, AdminPermissionLevel } from '../lib/config/adminConfig';

// 测试数据
const testUsers = [
  {
    sub: 'user-123',
    email: 'admin@example.com',
    expectedAdmin: true,
    expectedLevel: AdminPermissionLevel.SUPER_ADMIN
  },
  {
    sub: 'user-456',
    email: 'system.admin@company.com',
    expectedAdmin: true,
    expectedLevel: AdminPermissionLevel.SYSTEM_ADMIN
  },
  {
    sub: 'user-789',
    email: 'regular.user@company.com',
    expectedAdmin: false,
    expectedLevel: null
  },
  {
    sub: 'user-000',
    email: 'teacher@school.edu',
    expectedAdmin: false,
    expectedLevel: null
  }
];

/**
 * 运行管理员权限测试
 */
function runAdminPermissionTests() {
  console.log('🧪 开始管理员权限系统测试...\n');
  
  // 测试配置检查
  console.log('📋 管理员配置信息:');
  console.log('配置的管理员邮箱:', ADMIN_EMAILS);
  console.log('');

  let passedTests = 0;
  let totalTests = 0;

  // 测试每个用户
  testUsers.forEach((user, index) => {
    console.log(`👤 测试用户 ${index + 1}: ${user.email}`);
    
    // 测试 isAdmin 函数
    totalTests++;
    const isAdminResult = isAdmin(user.sub, user.email);
    if (isAdminResult === user.expectedAdmin) {
      console.log(`  ✅ isAdmin 测试通过: ${isAdminResult}`);
      passedTests++;
    } else {
      console.log(`  ❌ isAdmin 测试失败: 期望 ${user.expectedAdmin}, 实际 ${isAdminResult}`);
    }

    // 测试 getAdminPermissionLevel 函数
    totalTests++;
    const levelResult = getAdminPermissionLevel(user.email);
    if (levelResult === user.expectedLevel) {
      console.log(`  ✅ getAdminPermissionLevel 测试通过: ${levelResult}`);
      passedTests++;
    } else {
      console.log(`  ❌ getAdminPermissionLevel 测试失败: 期望 ${user.expectedLevel}, 实际 ${levelResult}`);
    }

    // 测试权限级别检查
    if (user.expectedAdmin) {
      totalTests++;
      const hasLogAccess = hasAdminPermission(user.email, AdminPermissionLevel.LOG_ADMIN);
      console.log(`  📊 日志访问权限: ${hasLogAccess ? '✅ 有权限' : '❌ 无权限'}`);
      if (hasLogAccess) passedTests++;

      totalTests++;
      const hasSystemAccess = hasAdminPermission(user.email, AdminPermissionLevel.SYSTEM_ADMIN);
      console.log(`  ⚙️ 系统管理权限: ${hasSystemAccess ? '✅ 有权限' : '❌ 无权限'}`);
      if (user.expectedLevel === AdminPermissionLevel.SUPER_ADMIN || user.expectedLevel === AdminPermissionLevel.SYSTEM_ADMIN) {
        if (hasSystemAccess) passedTests++;
      } else {
        if (!hasSystemAccess) passedTests++;
      }
    }

    console.log('');
  });

  // 测试总结
  console.log('📊 测试总结:');
  console.log(`总测试数: ${totalTests}`);
  console.log(`通过测试: ${passedTests}`);
  console.log(`测试成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('🎉 所有测试通过！管理员权限系统配置正确。');
  } else {
    console.log('⚠️ 部分测试失败，请检查配置。');
  }
}

/**
 * 测试模拟的 AppSync 上下文
 */
function testAppSyncContext() {
  console.log('\n🔧 测试 AppSync 上下文处理...\n');

  const mockContexts = [
    {
      identity: {
        sub: 'admin-user-123',
        claims: { email: 'admin@example.com' },
        username: 'admin@example.com'
      },
      description: '超级管理员'
    },
    {
      identity: {
        sub: 'regular-user-456',
        claims: { email: 'student@school.edu' },
        username: 'student@school.edu'
      },
      description: '普通用户'
    },
    {
      identity: {
        sub: 'teacher-user-789',
        claims: { email: 'teacher@school.edu' },
        username: 'teacher@school.edu'
      },
      description: '教师用户'
    }
  ];

  mockContexts.forEach((ctx, index) => {
    console.log(`🧪 测试上下文 ${index + 1}: ${ctx.description}`);
    
    try {
      // 模拟 getUserRoleInfo 函数的逻辑
      const userSub = ctx.identity?.sub;
      const userEmail = ctx.identity?.claims?.email || ctx.identity?.username;
      const userGroup = 'unknown'; // 在测试中我们不模拟 groups
      
      const adminStatus = isAdmin(userSub, userEmail);
      const adminLevel = adminStatus ? getAdminPermissionLevel(userEmail) : undefined;
      
      const userInfo = {
        userId: userSub,
        email: userEmail,
        group: userGroup,
        isAdmin: adminStatus,
        adminLevel,
      };

      console.log('  用户信息:', JSON.stringify(userInfo, null, 4));
      console.log('  ✅ 上下文处理成功');
    } catch (error) {
      console.log('  ❌ 上下文处理失败:', error);
    }
    
    console.log('');
  });
}

/**
 * 生成部署检查清单
 */
function generateDeploymentChecklist() {
  console.log('\n📋 部署前检查清单:\n');
  
  const checklist = [
    '1. ✅ 确认已在 lib/config/adminConfig.ts 中配置正确的管理员邮箱',
    '2. ✅ 确认已在 ui/src/utils/adminPermissions.ts 中同步管理员邮箱配置',
    '3. ✅ 确认管理员权限级别配置正确',
    '4. ✅ 确认 GraphQL schema 包含 checkAdminPermissions 查询',
    '5. ✅ 确认相关 resolver 已更新以支持管理员权限检查',
    '6. ⚠️ 测试管理员用户能否正常登录和访问功能',
    '7. ⚠️ 测试普通用户无法访问管理员功能',
    '8. ⚠️ 测试日志管理功能的权限控制',
    '9. ⚠️ 验证前端权限检查工作正常',
    '10. ⚠️ 进行端到端的权限测试'
  ];

  checklist.forEach(item => console.log(item));
  
  console.log('\n注意事项:');
  console.log('- ⚠️ 需要手动测试的项目');
  console.log('- 部署后请立即使用管理员账户测试所有功能');
  console.log('- 确保普通用户无法绕过权限检查');
}

// 运行所有测试
if (require.main === module) {
  runAdminPermissionTests();
  testAppSyncContext();
  generateDeploymentChecklist();
}

// 导出测试函数
export {
  runAdminPermissionTests,
  testAppSyncContext,
  generateDeploymentChecklist
};
