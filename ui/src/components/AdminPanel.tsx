// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 管理员权限组件示例
 * 展示如何在 React 组件中使用管理员权限检查
 */

import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Header, 
  SpaceBetween, 
  Button, 
  Box, 
  StatusIndicator,
  Alert
} from '@cloudscape-design/components';
import { checkUserAdminPermissions, AdminPermissionInfo } from '../utils/adminPermissions';
import { useUserProfile } from '../contexts/userProfile';

export default function AdminPanel() {
  const [adminInfo, setAdminInfo] = useState<AdminPermissionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = useUserProfile();

  // 检查管理员权限
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        setLoading(true);
        const info = await checkUserAdminPermissions();
        setAdminInfo(info);
      } catch (err: any) {
        setError(err.message || '检查权限时发生错误');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      checkPermissions();
    }
  }, [user]);

  if (loading) {
    return (
      <Container>
        <Box textAlign="center">
          <StatusIndicator type="loading">检查管理员权限...</StatusIndicator>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert type="error" header="权限检查失败">
          {error}
        </Alert>
      </Container>
    );
  }

  if (!adminInfo?.isAdmin) {
    return (
      <Container>
        <Alert type="warning" header="访问受限">
          此页面需要管理员权限。如果您认为这是错误，请联系系统管理员。
        </Alert>
      </Container>
    );
  }

  return (
    <Container
      header={
        <Header 
          variant="h1"
          description={`管理员级别: ${adminInfo.highestRole || '未知'}`}
        >
          管理员控制面板
        </Header>
      }
    >
      <SpaceBetween size="l">
        {/* 用户信息 */}
        <Box>
          <Header variant="h2">当前用户信息</Header>
          <Box variant="p">
            <strong>用户ID:</strong> {adminInfo.userId}<br/>
            <strong>邮箱:</strong> {adminInfo.email}<br/>
            <strong>用户组:</strong> {adminInfo.groups.join(', ')}<br/>
            <strong>管理员级别:</strong> {adminInfo.highestRole || '未指定'}
          </Box>
        </Box>

        {/* 权限功能 */}
        <Box>
          <Header variant="h2">可用功能</Header>
          <SpaceBetween size="s">
            {adminInfo.permissions.canManageUsers && (
              <Button 
                variant="normal"
                onClick={() => alert('用户管理功能开发中...')}
              >
                用户管理
              </Button>
            )}
            
            {adminInfo.permissions.canManageSystem && (
              <Button 
                variant="normal"
                onClick={() => alert('系统管理功能开发中...')}
              >
                系统管理
              </Button>
            )}
          </SpaceBetween>
        </Box>

        {/* 权限说明 */}
        <Box>
          <Header variant="h3">权限说明</Header>
          <ul>
            <li><strong>用户管理权限:</strong> {adminInfo.permissions.canManageUsers ? '✅ 已授权' : '❌ 未授权'}</li>
            <li><strong>系统管理权限:</strong> {adminInfo.permissions.canManageSystem ? '✅ 已授权' : '❌ 未授权'}</li>
          </ul>
        </Box>
      </SpaceBetween>
    </Container>
  );
}

/**
 * 管理员权限高阶组件示例
 * 包装任何需要管理员权限的组件
 */
export function withAdminAccess<T extends {}>(
  WrappedComponent: React.ComponentType<T>
) {
  return function AdminProtectedComponent(props: T) {
    const [adminInfo, setAdminInfo] = useState<AdminPermissionInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      checkUserAdminPermissions()
        .then(setAdminInfo)
        .finally(() => setLoading(false));
    }, []);

    if (loading) {
      return (
        <Box textAlign="center">
          <StatusIndicator type="loading">验证权限中...</StatusIndicator>
        </Box>
      );
    }

    if (!adminInfo?.isAdmin) {
      return (
        <Alert type="warning" header="需要管理员权限">
          访问此功能需要管理员权限。
        </Alert>
      );
    }

    return <WrappedComponent {...props} />;
  };
}
