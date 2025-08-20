// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 管理员权限显示测试组件
 * 用于测试和调试管理员权限在UI中的显示
 */

import { 
  Container, 
  Header, 
  SpaceBetween, 
  Box, 
  StatusIndicator,
  Alert,
  ColumnLayout 
} from '@cloudscape-design/components';
import { useAdminPermissions } from '../utils/adminPermissions';
import { getAdminLevelDisplayName } from '../utils/adminDisplayUtils';
import { useUserProfile } from '../contexts/userProfile';

export default function AdminPermissionTest() {
  const { adminInfo, loading, error } = useAdminPermissions();
  const userProfile = useUserProfile();

  return (
    <Container
      header={
        <Header variant="h1">
          管理员权限显示测试
        </Header>
      }
    >
      <SpaceBetween size="l">
        {/* 用户信息 */}
        <Box>
          <Header variant="h2">当前用户信息</Header>
          <ColumnLayout columns={2}>
            <Box>
              <strong>用户名:</strong> {userProfile?.name}<br/>
              <strong>邮箱:</strong> {userProfile?.email}<br/>
              <strong>用户组:</strong> {userProfile?.group}
            </Box>
            <Box>
              <strong>用户ID:</strong> {userProfile?.userId}
            </Box>
          </ColumnLayout>
        </Box>

        {/* 权限检查状态 */}
        <Box>
          <Header variant="h2">权限检查状态</Header>
          {loading && (
            <StatusIndicator type="loading">正在检查管理员权限...</StatusIndicator>
          )}
          {error && (
            <Alert type="error" header="权限检查失败">
              {error}
            </Alert>
          )}
          {!loading && !error && (
            <Alert 
              type={adminInfo?.isAdmin ? "success" : "info"} 
              header="权限检查完成"
            >
              {adminInfo?.isAdmin 
                ? `您是管理员用户，权限级别: ${getAdminLevelDisplayName(adminInfo.highestRole)}`
                : '您不是管理员用户'
              }
            </Alert>
          )}
        </Box>

        {/* 详细权限信息 */}
        {adminInfo?.isAdmin && (
          <Box>
            <Header variant="h2">详细权限信息</Header>
            <ColumnLayout columns={2}>
              <Box>
                <strong>管理员级别:</strong> {adminInfo.highestRole}<br/>
                <strong>显示名称:</strong> {getAdminLevelDisplayName(adminInfo.highestRole)}
              </Box>
              <Box>
                <strong>权限详情:</strong><br/>
                • 用户管理: {adminInfo.permissions.canManageUsers ? '✅' : '❌'}<br/>
                • 系统管理: {adminInfo.permissions.canManageSystem ? '✅' : '❌'}
              </Box>
            </ColumnLayout>
          </Box>
        )}

        {/* 使用说明 */}
        <Box>
          <Header variant="h3">测试说明</Header>
          <Box variant="p">
            1. 此页面用于测试管理员权限显示功能<br/>
            2. 权限验证完全基于后端配置，确保安全性<br/>
            3. 如果您的邮箱在后端管理员列表中，将显示相应的权限级别<br/>
            4. 权限级别会显示在顶部导航栏的用户菜单中<br/>
            5. 所有权限检查都通过 GraphQL 查询后端进行验证
          </Box>
        </Box>
      </SpaceBetween>
    </Container>
  );
}
